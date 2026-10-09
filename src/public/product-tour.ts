export const productTour: Record<string, { title: string; facts: string[]; href: string }> = {
  terminal: { title: 'Scan & bill.', facts: ['Scan barcodes', 'Apply discounts', 'Print receipts'], href: '/features#pos' },
  inventory: { title: 'Track stock.', facts: ['Receive stock', 'Set low-stock alerts', 'Review movements'], href: '/features#inventory' },
  stores: { title: 'Set up stores.', facts: ['Add locations', 'Create registers', 'Set receipt details'], href: '/features#multi-store' },
  permissions: { title: 'Set staff access.', facts: ['Assign roles', 'Choose stores', 'Enable MFA'], href: '/features#access' },
  reports: { title: 'Review your day.', facts: ['View cash totals', 'Review bills', 'Check critical stock'], href: '/features#reporting' },
}
