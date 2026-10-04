FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git cmake g++ make gperf libssl-dev zlib1g-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init && git remote add origin https://github.com/tdlib/telegram-bot-api.git && git fetch --depth 1 origin e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1 && git checkout --detach FETCH_HEAD && git submodule update --init --recursive --depth 1
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS_RELEASE="-O1 -DNDEBUG" && cmake --build build --target telegram-bot-api -j 1
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 zlib1g && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/telegram-bot-api /usr/local/bin/telegram-bot-api
USER 10001:10001
ENTRYPOINT ["telegram-bot-api"]
CMD ["--local","--http-port=8081","--dir=/telegram-data","--temp-dir=/telegram-data/tmp","--verbosity=0"]
