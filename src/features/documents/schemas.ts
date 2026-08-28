import { z } from "zod";
import {
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_VISIBILITIES,
} from "@/features/documents/types";

export const documentVisibilitySchema = z.enum(DOCUMENT_VISIBILITIES);
export const documentEntityTypeSchema = z.enum(DOCUMENT_ENTITY_TYPES);
export const documentMimeTypeSchema = z.enum(DOCUMENT_MIME_TYPES);

export const documentTitleSchema = z
  .string()
  .trim()
  .min(1, "عنوان الزامی است.")
  .max(180, "عنوان نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.");

export const documentDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "توضیحات نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.")
  .nullable();

export const createDocumentMetaSchema = z
  .object({
    title: documentTitleSchema,
    description: documentDescriptionSchema.optional(),
    visibility: documentVisibilitySchema,
    mimeType: documentMimeTypeSchema,
    fileSize: z
      .number()
      .int()
      .positive()
      .max(DOCUMENT_MAX_BYTES, "حجم فایل نمی‌تواند بیشتر از ۱۰ مگابایت باشد."),
  })
  .strict();

export const updateDocumentSchema = z
  .object({
    title: documentTitleSchema.optional(),
    description: documentDescriptionSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    { message: "حداقل یک تغییر لازم است." },
  );

export const createDocumentAttachmentSchema = z
  .object({
    entityType: documentEntityTypeSchema,
    entityId: z.uuid("شناسه موجودیت معتبر نیست."),
  })
  .strict();

export type CreateDocumentMetaInput = z.infer<typeof createDocumentMetaSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type CreateDocumentAttachmentInput = z.infer<
  typeof createDocumentAttachmentSchema
>;
