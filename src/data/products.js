const products = [
  {
    key: "macbookPro",
    title: "MacBook Pro",
    categoryKey: "electronics",
    price: 1999,
    oldPrice: 2299,
    badge: "sale",
    image: "💻",
    imageUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "smartWatch",
    title: "Smart Watch",
    categoryKey: "electronics",
    price: 299,
    badge: "stock",
    image: "⌚",
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "smartphonePro",
    title: "Smartphone Pro",
    categoryKey: "electronics",
    price: 1099,
    badge: "new",
    image: "📱",
    imageUrl:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "mirrorlessCamera",
    title: "Mirrorless Camera",
    categoryKey: "electronics",
    price: 899,
    badge: "new",
    image: "📷",
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "wirelessHeadphones",
    title: "Wireless Headphones",
    categoryKey: "electronics",
    price: 199,
    oldPrice: 249,
    badge: "sale",
    image: "🎧",
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "tabletPro",
    title: "Tablet Pro",
    categoryKey: "electronics",
    price: 749,
    badge: "stock",
    image: "📱",
    imageUrl:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "bluetoothSpeaker",
    title: "Bluetooth Speaker",
    categoryKey: "electronics",
    price: 129,
    badge: "stock",
    image: "🔊",
    imageUrl:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=82",
  },

  {
    key: "basicTshirt",
    title: "Basic T-Shirt",
    categoryKey: "fashion",
    price: 29,
    badge: "stock",
    image: "👕",
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "runningShoes",
    title: "Running Shoes",
    categoryKey: "fashion",
    price: 119,
    oldPrice: 149,
    badge: "sale",
    image: "👟",
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "classicSunglasses",
    title: "Classic Sunglasses",
    categoryKey: "fashion",
    price: 79,
    badge: "new",
    image: "🕶️",
    imageUrl:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "urbanBackpack",
    title: "Urban Backpack",
    categoryKey: "fashion",
    price: 89,
    badge: "stock",
    image: "🎒",
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "premiumHoodie",
    title: "Premium Hoodie",
    categoryKey: "fashion",
    price: 69,
    oldPrice: 89,
    badge: "sale",
    image: "🧥",
    imageUrl:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "leatherJacket",
    title: "Leather Jacket",
    categoryKey: "fashion",
    price: 229,
    badge: "new",
    image: "🧥",
    imageUrl:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=82",
  },

  {
    key: "deskLamp",
    title: "Desk Lamp",
    categoryKey: "home",
    price: 49,
    badge: "stock",
    image: "💡",
    imageUrl:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "officeChair",
    title: "Office Chair",
    categoryKey: "home",
    price: 179,
    oldPrice: 229,
    badge: "sale",
    image: "🪑",
    imageUrl:
      "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "modernSofa",
    title: "Modern Sofa",
    categoryKey: "home",
    price: 649,
    badge: "new",
    image: "🛋️",
    imageUrl:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "coffeeMaker",
    title: "Coffee Maker",
    categoryKey: "home",
    price: 129,
    oldPrice: 159,
    badge: "sale",
    image: "☕",
    imageUrl:
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "indoorPlant",
    title: "Indoor Plant",
    categoryKey: "home",
    price: 39,
    badge: "stock",
    image: "🪴",
    imageUrl:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "woodenTable",
    title: "Wooden Table",
    categoryKey: "home",
    price: 349,
    badge: "stock",
    image: "🪵",
    imageUrl:
      "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=82",
  },

  {
    key: "gamingHeadset",
    title: "Gaming Headset",
    categoryKey: "gaming",
    price: 149,
    oldPrice: 189,
    badge: "sale",
    image: "🎧",
    imageUrl:
      "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "mechanicalKeyboard",
    title: "Mechanical Keyboard",
    categoryKey: "gaming",
    price: 99,
    badge: "stock",
    image: "⌨️",
    imageUrl:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "wirelessController",
    title: "Wireless Controller",
    categoryKey: "gaming",
    price: 79,
    badge: "new",
    image: "🎮",
    imageUrl:
      "https://images.unsplash.com/photo-1605901309584-818e25960a8f?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "gamingMouse",
    title: "Gaming Mouse",
    categoryKey: "gaming",
    price: 69,
    badge: "stock",
    image: "🖱️",
    imageUrl:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "gamingMonitor",
    title: "Gaming Monitor",
    categoryKey: "gaming",
    price: 449,
    oldPrice: 549,
    badge: "sale",
    image: "🖥️",
    imageUrl:
      "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=900&q=82",
  },
  {
    key: "streamingMicrophone",
    title: "Streaming Microphone",
    categoryKey: "gaming",
    price: 159,
    badge: "new",
    image: "🎙️",
    imageUrl:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=82",
  },
];

export default products;