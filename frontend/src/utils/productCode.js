// [PRODUCTS] Product ID na makikita ng admin: PRD-0001, PRD-0002...
// Kung wala pang numero (hindi pa na-migrate ang database), ang internal id ang ipinapakita.
export function productCode(product) {
  return product.productNo ? `PRD-${String(product.productNo).padStart(4, '0')}` : product.id;
}
