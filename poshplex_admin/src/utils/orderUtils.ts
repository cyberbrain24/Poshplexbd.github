export function getOrderLocationZone(order: any): string {
  if (!order) return 'Outside Dhaka';

  // 1. Explicit delivery zone field
  const explicitZone = order.delivery_zone || order.shipping_zone || order.zone;
  if (explicitZone && typeof explicitZone === 'string') {
    const z = explicitZone.toLowerCase();
    if (z === 'inside_dhaka' || z === 'inside dhaka') return 'Inside Dhaka';
    if (z === 'suburban' || z === 'dhaka_suburban' || z === 'dhaka suburban') return 'Dhaka Suburban';
    if (z === 'outside_dhaka' || z === 'outside dhaka') return 'Outside Dhaka';
  }

  // 2. Infer from shipping_district/division name
  const district = (order.shipping_district || order.shipping_division || '').toLowerCase().trim();
  
  if (district === 'dhaka city') {
    return 'Inside Dhaka';
  }
  
  if (district === 'dhaka sub-urban' || district === 'dhaka suburban' || district === 'suburban') {
    return 'Dhaka Suburban';
  }

  // Handle ambiguous "dhaka"
  if (district === 'dhaka') {
    // If we have shipping_cost as a fallback to determine if it's suburban
    const cost = parseFloat(order.shipping_cost || 0);
    // Usually Inside Dhaka is around 60-80, Suburban is around 100-120
    if (cost > 0 && cost <= 80) {
      return 'Inside Dhaka';
    } else if (cost > 80 && cost < 130) {
      return 'Dhaka Suburban';
    }
    // Default fallback for "Dhaka"
    return 'Inside Dhaka';
  }

  // Anything else
  return 'Outside Dhaka';
}
