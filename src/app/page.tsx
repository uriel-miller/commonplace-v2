import { CartProvider } from "@/components/cart/CartProvider";
import { MarketplaceApp } from "@/components/marketplace/MarketplaceApp";

export default function HomePage() {
  return (
    <CartProvider>
      <MarketplaceApp />
    </CartProvider>
  );
}
