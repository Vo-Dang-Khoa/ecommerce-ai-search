export function genId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getEffectivePrice(product) {
  if (product?.promotion?.percent > 0) {
    const discounted =
      Math.round((product.price * (1 - product.promotion.percent / 100)) / 500) * 500;
    return Math.max(discounted, 0);
  }
  return product?.price ?? 0;
}

export function getProductImage(product) {
  return product?.images?.length > 0 ? product.images[0] : null;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
