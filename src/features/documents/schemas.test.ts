import { describe, expect, it } from "vitest";
import {
  createDocumentAttachmentSchema,
  createDocumentMetaSchema,
  updateDocumentSchema,
} from "@/features/documents/schemas";
import { DOCUMENT_MAX_BYTES } from "@/features/documents/types";

const entityId = "11111111-1111-4111-8111-111111111111";

describe("document schemas", () => {
  it("accepts a valid PDF metadata payload", () => {
    expect(
      createDocumentMetaSchema.safeParse({
        title: "قبض برق",
        visibility: "PRIVATE",
        mimeType: "application/pdf",
        fileSize: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid MIME type", () => {
    expect(
      createDocumentMetaSchema.safeParse({
        title: "ویروس",
        visibility: "PRIVATE",
        mimeType: "application/x-msdownload",
        fileSize: 1024,
      }).success,
    ).toBe(false);
  });

  it("rejects a file larger than 10MB", () => {
    expect(
      createDocumentMetaSchema.safeParse({
        title: "بزرگ",
        visibility: "PRIVATE",
        mimeType: "image/png",
        fileSize: DOCUMENT_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(
      createDocumentMetaSchema.safeParse({
        title: "   ",
        visibility: "PRIVATE",
        mimeType: "image/jpeg",
        fileSize: 10,
      }).success,
    ).toBe(false);
  });

  it("accepts attachment to a whitelisted entity", () => {
    expect(
      createDocumentAttachmentSchema.safeParse({
        entityType: "TASK",
        entityId,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid entity type", () => {
    expect(
      createDocumentAttachmentSchema.safeParse({
        entityType: "REMINDER",
        entityId,
      }).success,
    ).toBe(false);
  });

  it("requires at least one metadata field on update", () => {
    expect(updateDocumentSchema.safeParse({}).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ title: "جدید" }).success).toBe(
      true,
    );
  });
});
