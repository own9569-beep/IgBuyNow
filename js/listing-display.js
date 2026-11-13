// A missing amount represents an offer whose price will be agreed by quotation.
export function hasPrice(listing) {
 return listing.price !== null && listing.price !== undefined && listing.price !== '';
}
export function priceLabel(listing) {
 if (!hasPrice(listing)) return 'Sur devis';
 return Number(listing.price).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
}
export function discountLabel(listing) {
 const discount = Number(listing.discount_percent) || 0;
 return discount > 0 ? '−' + discount + ' %' : '';
}
