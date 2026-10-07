from __future__ import annotations
import json
import math
import os
import selectors
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from .core import Failure,log
from .workspace import regular, disk

@dataclass(frozen=True)
class Media:
    width: int
    height: int
    duration: float
    fps: float
    video_start: float = 0.0

class Runner:
    def __init__(self,config,check=lambda:None,pass_fds=()): self.config,self.check,self.pass_fds=config,check,pass_fds
    def run(self,args,timeout=None,progress=None):
        # No shell, stdin, network input protocols or uncontrolled diagnostic output.
        proc=subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,start_new_session=True,pass_fds=self.pass_fds,env={k:v for k,v in os.environ.items() if k in {'PATH','LANG','LC_ALL','TMPDIR'}})
        output=bytearray(); pending=b''; start=time.monotonic();last_log=start;metrics={}
        selector=selectors.DefaultSelector();selector.register(proc.stdout,selectors.EVENT_READ)
        try:
            while selector.get_map():
                self.check()
                if time.monotonic()-start>(timeout or self.config.process_timeout): raise Failure('processing_failed')
                if self.config.workspace.exists(): disk(self.config.workspace,0,self.config.min_free)
                for key,_ in selector.select(0.25):
                    chunk=os.read(key.fd,65536)
                    if not chunk: selector.unregister(key.fileobj);continue
                    if progress:
                        pending+=chunk
                        if len(pending)>65536: raise Failure('processing_failed')
                        while b'\n' in pending:
                            line,pending=pending.split(b'\n',1)
                            if line.startswith((b'fps=',b'speed=')):
                                try:
                                    key,value=line.decode().split('=',1);value=float(value.rstrip('x'))
                                    if math.isfinite(value):metrics[key]=value
                                except ValueError:pass
                            if line.startswith(b'progress=') and time.monotonic()-last_log>=30:
                                log('ffmpeg_progress',stage='transcode' if 'libx264' in args else 'decode',seconds=round(time.monotonic()-start,1),**metrics);last_log=time.monotonic()
                            if line.startswith(b'out_time_us='):
                                try: progress(max(0,int(line.split(b'=',1)[1]))/1e6)
                                except ValueError: pass
                    else:
                        output.extend(chunk)
                        if len(output)>2*1024*1024: raise Failure('invalid_media')
            if proc.wait(timeout=5)!=0: raise Failure('processing_failed')
            return bytes(output)
        finally:
            selector.close()
            if proc.poll() is None:
                os.killpg(proc.pid,signal.SIGTERM)
                try:proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid,signal.SIGKILL);proc.wait()
            proc.stdout.close()
    def probe(self,path,image=False):
        regular(path)
        try:
            raw=self.run(['ffprobe','-v','error','-protocol_whitelist','file,pipe','-format_whitelist',('hls,mpegts' if path.suffix=='.m3u8' else 'png_pipe,jpeg_pipe,webp_pipe,image2' if image else 'mov,matroska,webm,mpegts,avi'),'-show_streams','-show_format','-of','json',str(path)],timeout=60)
            data=json.loads(raw)
            videos=[s for s in data['streams'] if s.get('codec_type')=='video' and not s.get('disposition',{}).get('attached_pic')]
            if not videos: raise ValueError()
            v=videos[0];w=int(v['width']);h=int(v['height'])
            if not 16<=w<=8192 or not 16<=h<=8192 or not v.get('codec_name'): raise ValueError()
            # Reject rotated/anamorphic/HDR sources until explicit transforms are implemented.
            if v.get('sample_aspect_ratio','1:1') not in {'1:1','0:1','N/A'}: raise ValueError()
            if any(int(s.get('rotation',0))%360 for s in v.get('side_data_list',[])): raise ValueError()
            if v.get('color_transfer') in {'smpte2084','arib-std-b67'}: raise ValueError()
            if image:
                if v['codec_name'] not in {'png','mjpeg','webp'}: raise ValueError()
                return Media(w,h,0,0)
            duration=float(data['format']['duration'])
            numerator,denominator=v.get('avg_frame_rate','0/1').split('/')
            fps=float(numerator)/float(denominator)
            audio=[s for s in data['streams'] if s.get('codec_type')=='audio']
            if not audio or not audio[0].get('codec_name') or int(audio[0].get('channels',0))<1: raise ValueError()
            if not math.isfinite(duration) or not 0.1<=duration<=self.config.max_duration or not 1<=fps<=120: raise ValueError()
            start=float(v.get('start_time',0))
            if not math.isfinite(start) or abs(start)>3600: raise ValueError()
            log('source_probe',width=w,height=h,seconds=round(duration,2),fps=round(fps,2),bytes=path.stat().st_size,codec=v['codec_name'])
            return Media(w,h,duration,fps,start)
        except (ValueError,KeyError,TypeError,ZeroDivisionError,Failure) as exc:
            from .core import LeaseLost
            if isinstance(exc,LeaseLost): raise
            raise Failure('invalid_media') from None
    def decode(self,path,duration):
        # Full decode detects corrupt/truncated media before branding/expensive multi-rendition encode.
        last=[0.0]
        try:
            self.run(['ffmpeg','-nostdin','-v','error','-xerror','-err_detect','explode','-threads',str(self.config.threads),
                '-protocol_whitelist','file,pipe','-format_whitelist',('hls,mpegts' if path.suffix=='.m3u8' else 'mov,matroska,webm,mpegts,avi'),'-i',str(path),'-map','0:v:0','-map','0:a:0',
                '-progress','pipe:1','-nostats','-f','null','-'],progress=lambda n:last.__setitem__(0,n))
            if abs(last[0]-duration)>max(1,duration*0.02): raise Failure('invalid_media')
        except Failure as exc:
            from .core import LeaseLost
            if isinstance(exc,LeaseLost): raise
            raise Failure('invalid_media') from None

@dataclass(frozen=True)
class Rendition:
    width:int
    height:int
    bitrate:int

def renditions(media):
    # Aspect-preserving actual pixel dimensions; never add pixels to the source.
    output=[]
    for boxw,boxh,rate in [(1920,1080,5500000),(1280,720,2800000)]:
        factor=min(1,boxw/media.width,boxh/media.height)
        w=int(media.width*factor)//2*2;h=int(media.height*factor)//2*2
        if not output or (w,h)!=(output[-1].width,output[-1].height): output.append(Rendition(w,h,rate))
    if len(output)==1 and output[0].height<720:
        r=output[0];output=[Rendition(r.width,r.height,1500000)]
    return output

def encode(config,runner,source,media,intro,output,progress):
    variants=renditions(media)
    duration=media.duration+intro.duration
    # Upper bound based on output maxrates + input copy, with 50% mux/overhead reserve.
    estimate=int(duration*sum(r.bitrate*1.5+160000 for r in variants)/8*1.5)
    disk(output.parent,estimate,config.min_free)
    output.mkdir()
    for index,r in enumerate(variants):
        folder=output/str(index);folder.mkdir()
        fps=min(30,max(24,round(media.fps)))
        normalize=f'scale={r.width}:{r.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad={r.width}:{r.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},format=yuv420p'
        logo_width=max(16,int(r.width*0.10)//2*2)
        margin=max(8,int(r.width*0.015))
        x=str(margin) if config.position.endswith('left') else f'W-w-{margin}'
        y=str(margin) if config.position.startswith('top') else f'H-h-{margin}'
        graph=(f'[0:v:0]setpts=PTS-STARTPTS,{normalize}[iv];'
            f'[1:v:0]setpts=PTS-STARTPTS,{normalize}[sv];'
            f'[0:a:0]asetpts=PTS-({intro.video_start})/TB,aresample=48000:async=1:first_pts=0,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration={intro.duration}[ia];'
            f'[1:a:0]asetpts=PTS-({media.video_start})/TB,aresample=48000:async=1:first_pts=0,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration={media.duration}[sa];'
            '[iv][ia][sv][sa]concat=n=2:v=1:a=1[v][a];'
            f'[2:v:0]scale={logo_width}:-2,format=rgba,colorchannelmixer=aa={config.opacity}[logo];'
            f'[v][logo]overlay={x}:{y}:eof_action=repeat:shortest=0[out]')
        args=['ffmpeg','-nostdin','-v','error','-xerror','-filter_complex_threads','1']
        for asset in [config.intro,source,config.watermark]:
            args+=['-threads',str(config.threads),'-protocol_whitelist','file,pipe','-format_whitelist',('png_pipe,jpeg_pipe,webp_pipe,image2' if asset==config.watermark else 'mov,matroska,webm,mpegts,avi'),'-i',str(asset)]
        args+=['-filter_complex',graph,'-map','[out]','-map','[a]',
            '-c:v','libx264','-threads',str(config.threads),'-preset',config.preset,'-crf','21',
            '-maxrate',str(int(r.bitrate*1.5)),'-bufsize',str(r.bitrate*3),'-pix_fmt','yuv420p',
            '-profile:v','high','-g',str(fps*6),'-keyint_min',str(fps*6),'-sc_threshold','0',
            '-force_key_frames','expr:gte(t,n_forced*6)','-flags','+cgop',
            '-c:a','aac','-b:a','160k','-ar','48000','-ac','2',
            '-t',str(duration),'-max_muxing_queue_size','4096','-progress','pipe:1','-nostats',
            '-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_flags','independent_segments+temp_file',
            '-hls_segment_filename',str(folder/'segment_%06d.ts'),str(folder/'index.m3u8')]
        runner.run(args,progress=lambda seconds:progress((index+min(1,seconds/duration))/len(variants)))
    master=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-INDEPENDENT-SEGMENTS']
    for i,r in enumerate(variants):
        # BANDWIDTH is a conservative bound from encoder VBV, actual RESOLUTION powers hls.js labels.
        master += [f'#EXT-X-STREAM-INF:BANDWIDTH={int(r.bitrate*1.5)+200000},RESOLUTION={r.width}x{r.height},FRAME-RATE={fps}.000',f'{i}/index.m3u8']
    (output/'master.m3u8').write_text('\n'.join(master)+'\n')
    return variants,duration
