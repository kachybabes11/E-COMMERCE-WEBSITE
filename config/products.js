const productCatalog = [
  {
    id: 1,
    name: "Ruffle Sleeve Mini Dress",
    category: "Mini",
    price: 30464.99,
    stock: 12,
    description: "A feminine mini dress with soft ruffle sleeves, perfect for day-to-night styling.",
    sizes: [
      { size: "XS", dimensions: "32\"W x 24\"H" },
      { size: "S", dimensions: "34\"W x 25\"H" },
      { size: "M", dimensions: "36\"W x 26\"H" },
      { size: "L", dimensions: "38\"W x 27\"H" },
      { size: "XL", dimensions: "40\"W x 28\"H" },
    ],
    colors: [
      {
        name: "Black",
        images: [
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1515407573799-2d12d74f1a19?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1534070481839-586dc1a90f11?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Navy",
        images: [
          "https://images.unsplash.com/photo-1506228613408-eca07ce68773?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1515407573799-2d12d74f1a19?auto=format&fit=crop&w=900&q=80",
          "facebook-logo-blue-circle_705838-12823.avif",
        ],
      },
    ],
  },
  {
    id: 2,
    name: "High-Waist Skinny Jeans",
    category: "Mini",
    price: 42.99,
    stock: 10,
    description: "Modern high-waist skinny jeans with stretch for all-day comfort and a sleek silhouette.",
    sizes: [
      { size: "24", dimensions: "24\"W x 30\"L" },
      { size: "26", dimensions: "26\"W x 30\"L" },
      { size: "28", dimensions: "28\"W x 30\"L" },
      { size: "30", dimensions: "30\"W x 32\"L" },
      { size: "32", dimensions: "32\"W x 32\"L" },
    ],
    colors: [
      {
        name: "Dark Blue",
        images: [
          "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1542272604-787c62d465d1?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1565084905088-e5af5e0b9c81?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Black",
        images: [
          "https://images.unsplash.com/photo-1542272604-787c62d465d1?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1565084905088-e5af5e0b9c81?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 3,
    name: "Classic Leather Tote",
    category: "XL",
    price: 54.99,
    stock: 8,
    description: "A spacious and stylish tote made to carry every day essentials with ease.",
    sizes: [
      { size: "Small", dimensions: "12\"W x 10\"H" },
      { size: "Medium", dimensions: "14\"W x 12\"H" },
      { size: "Large", dimensions: "16\"W x 14\"H" },
    ],
    colors: [
      {
        name: "Cognac",
        images: [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Black",
        images: [
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1451649517753-7be0f6b1d565?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 4,
    name: "Textured Knit Sweater",
    category: "Large",
    price: 29.99,
    stock: 15,
    description: "A cozy knit sweater in a neutral hue, designed for effortless layering all season.",
    sizes: [
      { size: "XS", dimensions: "32\"W x 22\"L" },
      { size: "S", dimensions: "34\"W x 23\"L" },
      { size: "M", dimensions: "36\"W x 24\"L" },
      { size: "L", dimensions: "38\"W x 25\"L" },
    ],
    colors: [
      {
        name: "Cream",
        images: [
          "https://images.unsplash.com/photo-1495121605193-b116b5b9c5d5?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1508919801527-2c5413f117d2?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Gray",
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1508919801527-2c5413f117d2?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1506435773649-6f3db1b912d9?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 5,
    name: "Square Toe Sandals",
    category: "Unbranded",
    price: 36.99,
    stock: 5,
    description: "Comfortable square-toe sandals built for everyday wear and versatile styling.",
    sizes: [
      { size: "5", dimensions: "8\"W" },
      { size: "6", dimensions: "8.5\"W" },
      { size: "7", dimensions: "9\"W" },
      { size: "8", dimensions: "9.5\"W" },
      { size: "9", dimensions: "10\"W" },
      { size: "10", dimensions: "10.5\"W" },
    ],
    colors: [
      {
        name: "Gold",
        images: [
          "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Silver",
        images: [
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 6,
    name: "Statement Hoop Earrings",
    category: "Branded",
    price: 12.99,
    stock: 20,
    description: "A pair of polished hoops that complete any look with minimalist elegance.",
    sizes: [
      { size: "Small", dimensions: "1.5\"" },
      { size: "Medium", dimensions: "2\"" },
      { size: "Large", dimensions: "2.5\"" },
    ],
    colors: [
      {
        name: "Gold",
        images: [
          "https://images.unsplash.com/photo-1099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1632521674857-8f18e08bda5f?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Silver",
        images: [
          "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1632521674857-8f18e08bda5f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 7,
    name: "Tailored Blazer",
    category: "Medium",
    price: 62.99,
    stock: 9,
    description: "A structured blazer with sharp tailoring to elevate your everyday outfits.",
    sizes: [
      { size: "XS", dimensions: "32\"W x 24\"L" },
      { size: "S", dimensions: "34\"W x 25\"L" },
      { size: "M", dimensions: "36\"W x 26\"L" },
      { size: "L", dimensions: "38\"W x 27\"L" },
      { size: "XL", dimensions: "40\"W x 28\"L" },
    ],
    colors: [
      {
        name: "Black",
        images: [
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1559657348-f810a31eca6d?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1611832573519-1a6f37b5a5d5?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Navy",
        images: [
          "https://images.unsplash.com/photo-1559657348-f810a31eca6d?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1611832573519-1a6f37b5a5d5?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
  {
    id: 8,
    name: "City Crossbody Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      { size: "Small", dimensions: "8\"W x 6\"H" },
      { size: "Medium", dimensions: "10\"W x 7\"H" },
      { size: "Large", dimensions: "12\"W x 8\"H" },
    ],
    colors: [
      {
        name: "Black",
        images: [
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
        ],
      },
      {
        name: "Camel",
        images: [
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
        ],
      },
    ],
  },
]

export default productCatalog;