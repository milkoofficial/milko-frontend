import os

path = r'c:\Users\GOPES\OneDrive\Desktop\milko\components\MembershipSection.tsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

target_fetch = '''        if (data && data.length > 0) {
          // Filter to only show membership-eligible products
          const eligibleProducts = data.filter(p => p.isMembershipEligible === true);
          if (eligibleProducts.length > 0) {
            setProducts(eligibleProducts);
            setSelectedProduct(eligibleProducts[0].id);
          } else {
            // If no eligible products, show all active products as fallback
            const activeProducts = data.filter(p => p.isActive);
            setProducts(activeProducts.length > 0 ? activeProducts : data);
            setSelectedProduct(activeProducts.length > 0 ? activeProducts[0].id : data[0].id);
          }
        } else {'''

replacement_fetch = '''        if (data && data.length > 0) {
          let finalProducts = data;
          const eligibleProducts = data.filter(p => p.isMembershipEligible === true);
          if (eligibleProducts.length > 0) {
            finalProducts = eligibleProducts;
          } else {
            const activeProducts = data.filter(p => p.isActive);
            if (activeProducts.length > 0) finalProducts = activeProducts;
          }
          
          const withDetails = await Promise.all(
            finalProducts.map(async (p) => {
              try {
                return await productsApi.getById(p.id, true);
              } catch {
                return p;
              }
            })
          );
          setProducts(withDetails);
          
          if (withDetails.length > 0) {
            const firstProduct = withDetails[0];
            if (firstProduct.variations && firstProduct.variations.length > 0) {
              setSelectedProduct(`${firstProduct.id}::${firstProduct.variations[0].id}`);
            } else {
              setSelectedProduct(firstProduct.id);
            }
          }
        } else {'''

if target_fetch in c: c = c.replace(target_fetch, replacement_fetch)
elif target_fetch.replace('\n', '\r\n') in c: c = c.replace(target_fetch.replace('\n', '\r\n'), replacement_fetch.replace('\n', '\r\n'))

target_amount = '''  // Calculate total amount
  const selectedProductData = products.find(p => p.id === selectedProduct);
  const totalAmount = selectedProductData
    ? parseFloat(litersPerDay) * parseFloat(durationDays) * selectedProductData.pricePerLitre
    : 0;'''

replacement_amount = '''  // Calculate total amount
  let selectedProductData;
  let currentVariation;
  let basePrice = 0;

  if (selectedProduct) {
    const [pid, vid] = selectedProduct.split('::');
    selectedProductData = products.find(p => p.id === pid);
    if (selectedProductData) {
      if (vid && selectedProductData.variations) {
        currentVariation = selectedProductData.variations.find((v: any) => v.id === vid);
      }
      if (currentVariation) {
        basePrice = currentVariation.price ?? (selectedProductData.pricePerLitre * (currentVariation.priceMultiplier || 1));
      } else {
        basePrice = selectedProductData.pricePerLitre;
      }
    }
  }

  const totalAmount = selectedProductData
    ? parseFloat(litersPerDay) * parseFloat(durationDays) * basePrice
    : 0;'''

if target_amount in c: c = c.replace(target_amount, replacement_amount)
elif target_amount.replace('\n', '\r\n') in c: c = c.replace(target_amount.replace('\n', '\r\n'), replacement_amount.replace('\n', '\r\n'))

target_buy = '''    // Navigate to subscribe page with pre-filled data
    router.push(`/subscribe?productId=${selectedProduct}&liters=${litersPerDay}&days=${durationDays}&months=${months}`);'''

replacement_buy = '''    // Navigate to subscribe page with pre-filled data
    const [productId, variationId] = selectedProduct.split('::');
    let url = `/subscribe?productId=${productId}&liters=${litersPerDay}&days=${durationDays}&months=${months}`;
    if (variationId) {
      url += `&variationId=${variationId}`;
    }
    router.push(url);'''

if target_buy in c: c = c.replace(target_buy, replacement_buy)
elif target_buy.replace('\n', '\r\n') in c: c = c.replace(target_buy.replace('\n', '\r\n'), replacement_buy.replace('\n', '\r\n'))

target_options = '''                options={products.map((product) => ({
                  value: product.id,
                  label: `${product.name} - ₹${product.pricePerLitre}/litre`,
                }))}'''

replacement_options = '''                options={products.flatMap((product) => {
                  if (product.variations && product.variations.length > 0) {
                    return product.variations.map((v) => {
                      const price = v.price ?? (product.pricePerLitre * (v.priceMultiplier || 1));
                      return {
                        value: `${product.id}::${v.id}`,
                        label: `${product.name} [${v.size} - ₹${price}]`,
                      };
                    });
                  }
                  return [{
                    value: product.id,
                    label: `${product.name} [1L - ₹${product.pricePerLitre}]`,
                  }];
                })}'''

if target_options in c: c = c.replace(target_options, replacement_options)
elif target_options.replace('\n', '\r\n') in c: c = c.replace(target_options.replace('\n', '\r\n'), replacement_options.replace('\n', '\r\n'))

target_breakdown = '''            {selectedProductData && (
              <div className={styles.amountBreakdown}>
                {litersPerDay}L/day × {durationDays} days × ₹{formatINR(selectedProductData.pricePerLitre)}/L
              </div>
            )}'''

replacement_breakdown = '''            {selectedProductData && (
              <div className={styles.amountBreakdown}>
                {litersPerDay}L/day × {durationDays} days × ₹{formatINR(basePrice)}/L
              </div>
            )}'''

if target_breakdown in c: c = c.replace(target_breakdown, replacement_breakdown)
elif target_breakdown.replace('\n', '\r\n') in c: c = c.replace(target_breakdown.replace('\n', '\r\n'), replacement_breakdown.replace('\n', '\r\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Updated MembershipSection.tsx')
