import { NextRequest, NextResponse } from "next/server";
import { getDefaultTenantId, isLocalAdapter } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";
import { getServiceRoleClient } from "@/lib/server/supabase-service";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to upload assets" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP` },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image file exceeds maximum allowed size of 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${tenantId}/menu/${Date.now()}_${sanitizedFilename}`;

    if (isLocalAdapter()) {
      const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({ url: base64Data });
    }

    const client = getServiceRoleClient();
    const { error: uploadError } = await client.storage
      .from("cafe-assets")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get signed URL valid for 1 year or public URL
    const { data: urlData } = await client.storage
      .from("cafe-assets")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const imageUrl = urlData?.signedUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cafe-assets/${filePath}`;

    return NextResponse.json({ url: imageUrl, path: filePath }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process image upload" }, { status: 500 });
  }
}

