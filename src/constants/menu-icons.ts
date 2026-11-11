import {
  Apple, Banana, Beef, Beer, Cake, Candy, Cherry, Citrus, Coffee, Cookie, Croissant, CupSoda, Donut, Drumstick, Egg, Fish,
  GlassWater, Grape, Hamburger, IceCreamCone, Martini, Milk, Pizza, Salad, Sandwich, Soup, Utensils, Wine, type LucideIcon,
} from 'lucide-react';

/**
 * Pictogrammes de rubrique (spec 003) : même liste fermée que l'API
 * (backend/src/resources/menu/category-icons.ts). La carte se parcourt sans savoir lire.
 */
export const CATEGORY_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'utensils', label: 'Plats', icon: Utensils },
  { key: 'soup', label: 'Soupe, sauce', icon: Soup },
  { key: 'salad', label: 'Salade', icon: Salad },
  { key: 'fish', label: 'Poisson', icon: Fish },
  { key: 'drumstick', label: 'Poulet', icon: Drumstick },
  { key: 'beef', label: 'Viande', icon: Beef },
  { key: 'pizza', label: 'Pizza', icon: Pizza },
  { key: 'sandwich', label: 'Sandwich', icon: Sandwich },
  { key: 'hamburger', label: 'Burger', icon: Hamburger },
  { key: 'egg', label: 'Œufs', icon: Egg },
  { key: 'croissant', label: 'Viennoiserie', icon: Croissant },
  { key: 'cup-soda', label: 'Boisson, soda', icon: CupSoda },
  { key: 'glass-water', label: 'Eau', icon: GlassWater },
  { key: 'coffee', label: 'Café, thé', icon: Coffee },
  { key: 'beer', label: 'Bière', icon: Beer },
  { key: 'wine', label: 'Vin', icon: Wine },
  { key: 'martini', label: 'Cocktail', icon: Martini },
  { key: 'milk', label: 'Lait, yaourt', icon: Milk },
  { key: 'apple', label: 'Fruits', icon: Apple },
  { key: 'banana', label: 'Banane', icon: Banana },
  { key: 'citrus', label: 'Agrumes, jus', icon: Citrus },
  { key: 'grape', label: 'Raisin', icon: Grape },
  { key: 'cherry', label: 'Cerise', icon: Cherry },
  { key: 'ice-cream', label: 'Glace', icon: IceCreamCone },
  { key: 'cake', label: 'Gâteau', icon: Cake },
  { key: 'cookie', label: 'Biscuit', icon: Cookie },
  { key: 'donut', label: 'Beignet', icon: Donut },
  { key: 'candy', label: 'Bonbons', icon: Candy },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((entry) => [entry.key, entry]));

export function categoryIcon(key: string): LucideIcon {
  return BY_KEY.get(key)?.icon ?? Utensils;
}
