/** Streams bounded chunks to the native document picker, without disk caches. */
export function saveBackupNative(bytes: Uint8Array, name: string): void {
  const bridge = window.KhoonemoonNotifications;
  if (
    !bridge?.beginBinaryExport ||
    !bridge.appendBinaryExport ||
    !bridge.finishBinaryExport ||
    !bridge.cancelBinaryExport ||
    !bridge.beginBinaryExport()
  )
    throw new Error("امکان ذخیرهٔ پشتیبان وجود ندارد.");
  try {
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      const part = bytes.subarray(offset, offset + 32768);
      let binary = "";
      for (const byte of part) binary += String.fromCharCode(byte);
      if (!bridge.appendBinaryExport(btoa(binary)))
        throw new Error("آماده‌سازی فایل پشتیبان ناموفق بود.");
    }
    if (!bridge.finishBinaryExport(name))
      throw new Error("انتخاب محل ذخیره ناموفق بود.");
  } catch (error) {
    bridge.cancelBinaryExport();
    throw error;
  }
}
