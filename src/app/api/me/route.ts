import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { getOrCreateProfile, updateProfile } from "@/features/users/repository";
import { parseProfilePatch } from "@/features/users/validation";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const profile = await getOrCreateProfile(user);

    return ok({
      profile,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    await getOrCreateProfile(user);

    const payload = await readJsonObject(request);
    const parsed = parseProfilePatch(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await updateProfile(user.id, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
