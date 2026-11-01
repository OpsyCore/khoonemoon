/** After a confirmed mutation, a failed reload must not be reported as a failed write. */
export async function reloadAfterSave(
  reload: () => Promise<void>,
): Promise<boolean> {
  try {
    await reload();
    return true;
  } catch {
    return false;
  }
}
