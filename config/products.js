const productCatalog = [
  {
    id: 1,
    name: "Miss Gail Bag",
    category: "Mini",
    price: 25000,
    stock: 12,
    description: "A feminine mini dag with attention to detail, perfect for day-to-night styling.",
    sizes: [
      { size: "S", dimensions: "34\"W x 25\"H" },
    ],

    colors: [
      {
        name: "Light Purple",
        images: [
          "../assets/Light-purple-miss-gail-1.jpeg",
          "../assets/Light-purple-miss-gail-2.jpeg",
          "../assets/Light-purple-miss-gail-3.jpeg",
        ],
      }
    ],
  },
  {
    id: 2,
    name: "Black and white YSL Bag",
    category: "Mini",
    price: 18000,
    stock: 10,
    description: "Modern day bag for all-day comfort and a sleek silhouette.",
    sizes: [
    
      { size: "M", dimensions: "26\"W x 30\"L" },
      
    ],
    colors: [
      {
        name: "Black & White",
        images: [
          "../assets/Black-and-white-YSL-1.jpeg",
          "../assets/Black-and-white-YSL-2.jpeg",
          "../assets/Black-and-white-YSL-3.jpeg",
        ],
      }
    ],
  },
  {
    id: 3,
    name: "Classic Leather LV Bag",
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
        name: "Red",
        images: [
          "../assets/WhatsApp Image 2026-06-10 at 17.02.40 (6).jpeg",
          "../assets/Red-LV-beaded-2.jpeg",
          "../assets/Red-LV-beaded-1.jpeg",
        ],
      },
      {
        name: "White",
        images: [
          "../assets/White-LV-beaded-1.jpeg",
          "../assets/White-LV-beaded-2.jpeg",
        ],
      },
      {
        name: "Gold",
        images: [
          "../assets/Gold-LV-beaded-1.jpeg",
          "../assets/Gold-LV-beaded-2.jpeg",
        ],
      }
    ],
  },
  {
    id: 4,
    name: "Fendi Shoulder Bag",
    category: "Mini",
    price: 15000,
    stock: 1,
    description: "A cozy knit sweater in a neutral hue, designed for effortless layering all season.",
    sizes: [
     
      { size: "S", dimensions: "34\"W x 23\"L" },
    ],
    colors: [
      {
        name: "Print",
        images: [
          "../assets/Fendi-shoulder-bag-1.jpeg",
          "../assets/Fendi-shoulder-bag-2.jpeg",
          "../assets/Fendi-shoulder-bag-3.jpeg",

        ],
      },
    ],
  },
  {
    id: 5,
    name: "Bottega Venetta Arindion Top Closed",
    category: "Unbranded",
    price: 36.99,
    stock: 5,
    description: "Comfortable square-toe sandals built for everyday wear and versatile styling.",
    sizes: [

      { size: "S", dimensions: "8.5\"W" },
      
    ],
    colors: [
       {
        name: "Dark Green",
        images: [
          "../assets/thumbnails/thumbnail-2.jpeg",
          "../assets/Green-bottega-veneta1..jpeg",
           "../assets/Green-bottega-veneta2..jpeg"
        ],
      },
      {
        name: "Gold",
        images: [
          "../assets/Gold-bottega-veneta-1.jpeg",
          "../assets/Gold-bottega-veneta-2.jpeg",
          "../assets/Gold-bottega-veneta-3.jpeg",
        ],
      },
      {
        name: "Burgundy",
        images: [
          "../assets/Burgundy-bottega-veneta-1.jpeg",
          "../assets/Burgundy-bottega-veneta-2.jpeg",
          "../assets/Burgundy-bottega-veneta-3.jpeg",
        ],
      },
      {
        name: "Brown",
        images: [
          "../assets/Brown-bottega-veneta-2.jpeg",
          "../assets/Brown-bottega-veneta-1.jpeg",
          "../assets/Brown-bottega-veneta-3.jpeg",
        ],
      },
      {
        name: "White",
        images: [
          "../assets/white-bottega-veneta-1.jpeg",
          "../assets/white-bottega-veneta-2.jpeg",
          "../assets/white-bottega-veneta-3.jpeg",
        ],
      },
      {
        name: "Black A",
        images: [
          "../assets/Black-bottega-veneta-new-design-1.jpeg",
          "../assets/Black-bottega-veneta-new-design-2.jpeg",
        ],
      },
      {
        name: "Black B",
        images: [
          "../assets/Black-bottega-veneta-old-design-1.jpeg",
          "../assets/Black-bottega-veneta-old-design-2.jpeg",
        ]
      },
    ],
  },
  {
    id: 6,
    name: "Lady Dior Patent Leather Set",
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
        name: "Black with Gold platings",
        images: [
          "../assets/Lady-dior-patent-set.jpeg",
          "../assets/Black-patent-leather-lady-dior-1.jpeg",
          "../assets/Black-patent-leather-lady-dior-2.jpeg",
        ],
      },
         {
        name: "Black with Silver platings",
        images: [
          "../assets/Black-patent-leather-lady-dior-3.jpeg",
          "../assets/Black-patent-leather-lady-dior-4.jpeg",
        ],
      },
      {
        name: "Red",
        images: [
          "../assets/Red-patent-leather-lady-dior-1.jpeg",
          "../assets/Red-patent-leather-lady-dior-2.jpeg",
        ],
      },
      {
        name: "Green",
        images: [
          "../assets/Green-patent-leather-lady-dior-1.jpeg",
          "../assets/Green-patent-leather-lady-dior-2.jpeg",
        ],
      },
      {
        name: "Pink",
        images: [
          "../assets/Pink-patent-leather-lady-dior-1.jpeg",
          "../assets/pink-patent-leather-lady-dior-2.jpeg",
        ],
      },
    ],
  },
  {
    id: 7,
    name: "Casual Flip Over Purse",
    category: "Medium",
    price: 62.99,
    stock: 9,
    description: "A structured blazer with sharp tailoring to elevate your everyday outfits.",
    sizes: [
      
      { size: "S", dimensions: "34\"W x 25\"L" },
      
    ],
    colors: [
      {
        name: "Green",
        images: [
          "../assets/unbranded-green-and-cream-set.jpeg",
          "../assets/Green-flipOver-with-stone-1.jpeg",
          "../assets/Green-flipOver-with-stone-2.jpeg",
        ],
      },
      {
        name: "Cream",
        images: [
          "../assets/Cream-flipOver-with-stone-1.jpeg",
          "../assets/Cream-flipOver-with-stone-2.jpeg",
        ],
      },
    ],
  },
  {
    id: 8,
    name: "Dior Crossbody Bag",
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
        name: "Black Dior Print",
        images: [
          "../assets/Dior-crossbag-1.jpeg",
          "../assets/Dior-crossbag-2.jpeg",
          "../assets/Dior-crossbag-3.jpeg"
        ],
      },
    ],
  },
    {
    id: 9,
    name: "Dome Bags",
    category: "Shoulder Bags",
    price: 15000,
    stock: 6,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "Medium", dimensions: "10\"W x 7\"H" },
    
    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Dome-bags-set.jpeg",
          "../assets/Black-dome-1.jpeg",
          "../assets/Black-dome-2.jpeg"
        ],
      },
      {
        name: "Wine",
        images: [
          "../assets/Wine-dome-1.jpeg",
          "../assets/Wine-dome-2.jpeg"
          
        ],
      },
    ],
  },
    {
    id: 10,
    name: "Miss Gail Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "Medium", dimensions: "10\"W x 7\"H" },
    
    ],
    colors: [
      {
        name: "Pink",
        images: [
          "../assets/Pink-miss-gail-2.jpeg",
          "../assets/Pink-miss-gail-1.jpeg",
          
        ],
      }
    ],
  },
    {
    id: 11,
    name: "Coach Bag",
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
        name: "Coach with white strap",
        images: [
          "../assets/Different-handles-coach-bags.jpeg",
          "../assets/Coach-football-with-white-strap-1.jpeg",
          "../assets/Coach-football-with-white-strap-2.jpeg"
        ],
      },
      {
        name: "Coach with brown strap",
        images: [
          "../assets/Coach-football-with-brown-strap-1.jpeg",
          "../assets/Coach-football-with-brown-strap-1.jpeg"
        ],
      },
    ],
  },
    {
    id: 12,
    name: "Striped Heather Bag",
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
          "../assets/Black-striped-heather-1.jpeg",
          "../assets/Black-striped-heather-2.jpeg",
         
        ],
      },
     
    ],
  },
    {
    id: 13,
    name: "Stoned Valentino",
    category: "Shoulder Bags",
    price: 20000,
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
          "../assets/Black-stoned-valentino-1.jpeg",
          "../assets/Black-stoned-valentino-2.jpeg",
          "../assets/Black-stoned-valentino-3.jpeg"
        ],
      },
    
    ],
  },
    {
    id: 14,
    name: "Coach Shoulder Bag",
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
          "../assets/thumbnails/thumbnail-5.jpeg",
          "../assets/Black-Coach-Bag-1.jpeg",

        ],
      },
            {
        name: "Light Brown",
        images: [
          "../assets/Brown-Coach-Bag-2.jpeg"
        ],
      },
            {
        name: "Dark Brown",
        images: [
          "../assets/Brown-Coach-Bag-3.jpeg"
        ],
      },
            {
        name: "Green",
        images: [
          "../assets/Dior-crossbag-1.jpeg",
          "../assets/Dior-crossbag-2.jpeg",
          "../assets/Dior-crossbag-3.jpeg"
        ],
      },
      
      
    ],
  },
      {
    id: 15,
    name: "Plain Heather Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      { size: "M", dimensions: "10\"W x 7\"H" },
    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Black-plain-heather-1.jpeg",
          "../assets/Black-plain-heather-2.jpeg",
          
        ],
      },
     
    ],
  },
      {
    id: 16,
    name: "Miss Gail Bag",
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
        name: "Red",
        images: [
          "../assets/Red-miss-gail-1.jpeg",
          "../assets/Red-miss-gail-2.jpeg",
          "../assets/Red-miss-gail-3.jpeg"
        ],
      },
     
    ],
  },
  {
    id: 17,
    name: "Kurt Geiger Flip Over",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Blue",
        images: [
          "../assets/Blue-kurt-geiger-1.jpeg",
          "../assets/Blue-kurt-geiger-2.jpeg",

        ]
      }
    ],
    },
       {
    id: 18,
    name: "Lady D'joy Patent Leather",
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
        name: "Pink",
        images: [
          "../assets/Lady d'joy set.jpeg",
         "../assets/Pink-patent-leather-lady-djoy-2.jpeg",
         "../assets/Pink-patent-leather-lady-djoy-1.jpeg"
        ],
      },
      {
        name: "Beige",
        images: [
         "../assets/Lady d'joy set.jpeg",
          "../assets/Pink-patent-leather-lady-djoy-2.jpeg",
         "../assets/WhatsApp Video 2026-06-10 at 17.02.37.mp4"
        ],
      },
       {
        name: "Black",
        images: [
          "../assets/Black-patent-leather-lady-djoy-2.jpeg",
         "../assets/Black-patent-leather-lady-djoy-1.jpeg"
        ],
      }
    ],
  },
  {
    id: 19,
    name: "Chic Purses",
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
        name: "Green",
        images: [
          "../assets/Green-and-white-purses.jpeg",
         "../assets/Green-purse-1.jpeg",

        ],
      },
      {
        name: "White",
        images: [
         "../assets/White-purse.jpeg",
        
        ],
      }
    ],
  },
  {
    id: 20,
    name: "YSL Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Red",
        images: [
          "../assets/Red-YSL-1.jpeg",
          "../assets/Red-YSL-2.jpeg",
          "../assets/Red-YSL-3.jpeg",
        ]
      }
    ],
    },
    {
    id: 21,
    name: "Lady Dior with Adornments",
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
        name: "Pink with silver platings",
        images: [
          "../assets/Pink-lady-dior-with-adornments-3.jpeg",
          "../assets/Pink-lady-dior-with-adornments-1.jpeg",

        ],
      },
      {
        name: "Black with Gold Platings",
        images: [
         "../assets/Black-lady-dior-with-gold-adornment-2.jpeg",
         "../assets/Black-lady-dior-with-gold-adornment-1.jpeg",
        
        ],
      }
    ],
  },
    {
    id: 22,
    name: "Fendi Dome Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Fendi Print",
        images: [
          "../assets/Fendi-print-dome-1.jpeg",
          "../assets/Fendi-print-dome-2.jpeg",
          
        ]
      }
    ],
    },
      {
    id: 23,
    name: "Kurt Geiger Flip Over",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Red",
        images: [
          "../assets/White-designed-kurt-geiger-1.jpeg",
          "../assets/White-designed-kurt-geiger-2.jpeg",
          
        ]
      }
    ],
    },
      {
    id: 24,
    name: "Lady D'joy Matte Leather",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Black-matte-leather-lady-djoy-1.jpeg",
          "../assets/Black-matte-leather-lady-djoy-2.jpeg",
         
        ]
      }
    ],
    },
        {
    id: 25,
    name: "Plain Kurt Geiger FlipOver",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      { size: "M", dimensions: "10\"W x 7\"H" },
    ],
    colors: [
      {
        name: "Burgundy",
        images: [
          "../assets/Burgundy-kurt-geiger-1.jpeg",
          "../assets/Burgundy-kurt-geiger-2.jpeg",

        ],
      },
      {
        name: "Black",
        images: [
         "../assets/Black-kurt-geiger-3.jpeg",
         "../assets/Black-kurt-geiger-4.jpeg",
        
        ],
      }
    ],
  },
     {
    id: 26,
    name: "Kurt Geiger Flip Over",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Black",
        images: [
         "../assets/Black-kurt-geiger-2.jpeg",
          "../assets/Black-kurt-geiger-1.jpeg",
         
        ]
      }
    ],
    },
    {
    id: 27,
    name: "Dior Dome Bag",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Dior Print",
        images: [
          "../assets/Dior-print-dome-2.jpeg",
         
        ]
      }
    ],
    },
    {
    id: 28,
    name: "Lady Dior Matte Leather",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Black-matte-leather-lady-dior-1.jpeg",
          "../assets/Black-matte-leather-lady-dior-2.jpeg",
         
        ]
      }
    ],
    },
    {
    id: 29,
    name: "Lady Dior Flowered Pattern",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Purple-flower-print-lady-dior-1.jpeg",
          "../assets/Purple-flower-print-lady-dior-2.jpeg",
        ]
      }
    ],
    },
    {
    id: 30,
    name: "Lady Dior",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Dior Print",
        images: [
          "../assets/Dior-print-lady-dior-1.jpeg",
          "../assets/Dior-print-lady-dior-2.jpeg",
         
        ]
      }
    ],
    },
    {
    id: 24,
    name: "Lady D'joy Matte Leather",
    category: "Shoulder Bags",
    price: 39.99,
    stock: 14,
    description: "A compact crossbody bag for hands-free styling and modern city life.",
    sizes: [
      
      { size: "M", dimensions: "10\"W x 7\"H" },

    ],
    colors: [
      {
        name: "Black",
        images: [
          "../assets/Black-matte-leather-lady-djoy-1.jpeg",
          "../assets/Black-matte-leather-lady-djoy-2.jpeg",
         
        ]
      }
    ],
    },
    ]
  
export default productCatalog;