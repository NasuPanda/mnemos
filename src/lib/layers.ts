/** Whether a popover, menu, sheet or dialog is open; it has the keys until it closes. */
export function openLayer(): boolean {
  return !!document.querySelector(
    '[data-slot="popover-content"], [data-slot="dropdown-menu-content"], [data-slot="drawer-content"], [data-slot="alert-dialog-content"], [data-slot="dialog-content"]',
  );
}
