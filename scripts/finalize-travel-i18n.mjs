import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = ".github/workflows/finalize-travel-i18n.yml";
const scriptPath = "scripts/finalize-travel-i18n.mjs";

const translations = {
  en: {
    navLabel: "Travel",
    page: {
      onlineTravelAgency: "ONLINE TRAVEL AGENCY",
      pill: "Masterota Travel",
      heroTitle: "Build your holiday route",
      heroAccent: "in one place.",
      heroText:
        "Find your hotel, plan your flight, rent a car and add experiences to your journey. Soon, manage everything on one platform with card or crypto payments.",
      trustSecure: "Secure booking infrastructure",
      trustPayment: "Card and Web3 payment vision",
      servicesLabel: "Travel services",
      services: {
        hotels: {
          label: "Hotels",
          eyebrow: "Find your accommodation route",
          title: "Where would you like to go?",
          locationLabel: "Destination",
          locationPlaceholder: "Antalya, Istanbul, Rome...",
          button: "Search Hotels",
        },
        flights: {
          label: "Flights",
          eyebrow: "Plan your flight route",
          title: "Where does your next journey begin?",
          locationLabel: "Departure and arrival",
          locationPlaceholder: "Antalya → Moscow",
          button: "Search Flights",
        },
        cars: {
          label: "Car Rental",
          eyebrow: "Add freedom to your journey",
          title: "Where would you like to pick up your car?",
          locationLabel: "Pick-up location",
          locationPlaceholder: "Antalya Airport",
          button: "Search Cars",
        },
        activities: {
          label: "Activities",
          eyebrow: "Truly discover the city",
          title: "Which city would you like to experience?",
          locationLabel: "City or region",
          locationPlaceholder: "Cappadocia, Dubai, Phuket...",
          button: "Search Activities",
        },
      },
      search: {
        start: "Start",
        end: "End",
        guests: "Guests / Passengers",
        people1: "1 person",
        people2: "2 people",
        people3: "3 people",
        people4: "4 people",
        people5: "5+ people",
      },
      prototypeNote:
        "The search interface is ready. Live prices and availability will appear here after the travel API integration.",
      routesEyebrow: "MASTEROTA ROUTES",
      routesTitle: "From your shopping route to your holiday route.",
      routesText:
        "Travel works separately from the store while the account, language and payment experience stay under the Masterota roof.",
      cards: {
        antalya: {
          badge: "Popular",
          title: "Antalya Route",
          text: "Beach hotels, transfers and summer experiences.",
        },
        istanbul: {
          badge: "City",
          title: "Istanbul Route",
          text: "City hotels, flights and curated activities.",
        },
        freedom: {
          badge: "Coming Soon",
          title: "Freedom Route",
          text: "Rent a car and create your own route.",
        },
      },
      exploreRoute: "Explore route",
    },
  },
  tr: {
    navLabel: "Travel",
    page: {
      onlineTravelAgency: "ONLINE TRAVEL AGENCY",
      pill: "Masterota Travel",
      heroTitle: "Tatil rotanı tek yerde",
      heroAccent: "oluştur.",
      heroText:
        "Otelini bul, uçuşunu planla, aracını kirala ve deneyimlerini yolculuğuna ekle. Yakında kart veya kripto ile her şeyi tek platformdan yönet.",
      trustSecure: "Güvenli rezervasyon altyapısı",
      trustPayment: "Kart ve Web3 ödeme vizyonu",
      servicesLabel: "Seyahat hizmetleri",
      services: {
        hotels: {
          label: "Oteller",
          eyebrow: "Konaklama rotanı bul",
          title: "Nereye gitmek istiyorsun?",
          locationLabel: "Destinasyon",
          locationPlaceholder: "Antalya, İstanbul, Roma...",
          button: "Otel Ara",
        },
        flights: {
          label: "Uçuşlar",
          eyebrow: "Uçuş rotanı planla",
          title: "Sıradaki yolculuğun nerede başlıyor?",
          locationLabel: "Kalkış ve varış",
          locationPlaceholder: "Antalya → Moskova",
          button: "Uçuş Ara",
        },
        cars: {
          label: "Araç Kiralama",
          eyebrow: "Yolculuğuna özgürlük kat",
          title: "Aracını nereden teslim almak istiyorsun?",
          locationLabel: "Teslim alma noktası",
          locationPlaceholder: "Antalya Havalimanı",
          button: "Araç Ara",
        },
        activities: {
          label: "Aktiviteler",
          eyebrow: "Şehri gerçekten keşfet",
          title: "Hangi şehirde deneyim arıyorsun?",
          locationLabel: "Şehir veya bölge",
          locationPlaceholder: "Kapadokya, Dubai, Phuket...",
          button: "Aktivite Ara",
        },
      },
      search: {
        start: "Başlangıç",
        end: "Bitiş",
        guests: "Misafir / Yolcu",
        people1: "1 kişi",
        people2: "2 kişi",
        people3: "3 kişi",
        people4: "4 kişi",
        people5: "5+ kişi",
      },
      prototypeNote:
        "Arama ekranı hazır. Gerçek fiyat ve müsaitlik sonuçları travel API bağlantısıyla burada açılacak.",
      routesEyebrow: "MASTEROTA ROTALARI",
      routesTitle: "Alışveriş rotandan tatil rotana.",
      routesText:
        "Travel bölümü mağazadan ayrı çalışır; hesap, dil ve ödeme deneyimi Masterota çatısı altında kalır.",
      cards: {
        antalya: {
          badge: "Popüler",
          title: "Antalya Rotası",
          text: "Sahil otelleri, transfer ve yaz deneyimleri.",
        },
        istanbul: {
          badge: "Şehir",
          title: "İstanbul Rotası",
          text: "Şehir otelleri, uçuşlar ve özel aktiviteler.",
        },
        freedom: {
          badge: "Yakında",
          title: "Özgür Yolculuk",
          text: "Araç kirala, kendi rotanı kendin oluştur.",
        },
      },
      exploreRoute: "Rotayı keşfet",
    },
  },
  ru: {
    navLabel: "Путешествия",
    page: {
      onlineTravelAgency: "ОНЛАЙН-ТУРАГЕНТСТВО",
      pill: "Masterota Travel",
      heroTitle: "Создайте маршрут путешествия",
      heroAccent: "в одном месте.",
      heroText:
        "Найдите отель, спланируйте перелёт, арендуйте автомобиль и добавьте впечатления. Скоро всё это будет доступно на одной платформе с оплатой картой или криптовалютой.",
      trustSecure: "Безопасная система бронирования",
      trustPayment: "Оплата картой и Web3",
      servicesLabel: "Туристические услуги",
      services: {
        hotels: {
          label: "Отели",
          eyebrow: "Найдите место для проживания",
          title: "Куда вы хотите отправиться?",
          locationLabel: "Направление",
          locationPlaceholder: "Анталья, Стамбул, Рим...",
          button: "Найти отели",
        },
        flights: {
          label: "Авиабилеты",
          eyebrow: "Спланируйте маршрут полёта",
          title: "Где начинается ваше следующее путешествие?",
          locationLabel: "Вылет и прибытие",
          locationPlaceholder: "Анталья → Москва",
          button: "Найти рейсы",
        },
        cars: {
          label: "Аренда авто",
          eyebrow: "Добавьте свободы в путешествие",
          title: "Где вы хотите получить автомобиль?",
          locationLabel: "Место получения",
          locationPlaceholder: "Аэропорт Антальи",
          button: "Найти авто",
        },
        activities: {
          label: "Развлечения",
          eyebrow: "Откройте город по-настоящему",
          title: "В каком городе вы ищете впечатления?",
          locationLabel: "Город или регион",
          locationPlaceholder: "Каппадокия, Дубай, Пхукет...",
          button: "Найти развлечения",
        },
      },
      search: {
        start: "Начало",
        end: "Окончание",
        guests: "Гости / Пассажиры",
        people1: "1 человек",
        people2: "2 человека",
        people3: "3 человека",
        people4: "4 человека",
        people5: "5+ человек",
      },
      prototypeNote:
        "Интерфейс поиска готов. Реальные цены и доступность появятся здесь после подключения travel API.",
      routesEyebrow: "МАРШРУТЫ MASTEROTA",
      routesTitle: "От маршрута покупок к маршруту отдыха.",
      routesText:
        "Раздел путешествий работает отдельно от магазина, а аккаунт, язык и оплата остаются частью экосистемы Masterota.",
      cards: {
        antalya: {
          badge: "Популярно",
          title: "Маршрут Антальи",
          text: "Пляжные отели, трансферы и летние впечатления.",
        },
        istanbul: {
          badge: "Город",
          title: "Маршрут Стамбула",
          text: "Городские отели, перелёты и специальные активности.",
        },
        freedom: {
          badge: "Скоро",
          title: "Свободный маршрут",
          text: "Арендуйте автомобиль и создайте собственный маршрут.",
        },
      },
      exploreRoute: "Открыть маршрут",
    },
  },
  ar: {
    navLabel: "السفر",
    page: {
      onlineTravelAgency: "وكالة سفر إلكترونية",
      pill: "Masterota Travel",
      heroTitle: "أنشئ مسار رحلتك",
      heroAccent: "في مكان واحد.",
      heroText:
        "اعثر على فندقك، خطط لرحلتك الجوية، استأجر سيارة وأضف التجارب إلى رحلتك. قريباً ستدير كل شيء من منصة واحدة بالدفع بالبطاقة أو العملات الرقمية.",
      trustSecure: "بنية حجز آمنة",
      trustPayment: "رؤية للدفع بالبطاقات وWeb3",
      servicesLabel: "خدمات السفر",
      services: {
        hotels: {
          label: "الفنادق",
          eyebrow: "اعثر على مسار إقامتك",
          title: "إلى أين تريد الذهاب؟",
          locationLabel: "الوجهة",
          locationPlaceholder: "أنطاليا، إسطنبول، روما...",
          button: "ابحث عن فندق",
        },
        flights: {
          label: "الرحلات",
          eyebrow: "خطط لمسار رحلتك الجوية",
          title: "من أين تبدأ رحلتك القادمة؟",
          locationLabel: "المغادرة والوصول",
          locationPlaceholder: "أنطاليا ← موسكو",
          button: "ابحث عن رحلة",
        },
        cars: {
          label: "تأجير السيارات",
          eyebrow: "أضف الحرية إلى رحلتك",
          title: "من أين تريد استلام السيارة؟",
          locationLabel: "موقع الاستلام",
          locationPlaceholder: "مطار أنطاليا",
          button: "ابحث عن سيارة",
        },
        activities: {
          label: "الأنشطة",
          eyebrow: "اكتشف المدينة فعلاً",
          title: "في أي مدينة تبحث عن تجربة؟",
          locationLabel: "المدينة أو المنطقة",
          locationPlaceholder: "كابادوكيا، دبي، بوكيت...",
          button: "ابحث عن نشاط",
        },
      },
      search: {
        start: "البداية",
        end: "النهاية",
        guests: "الضيوف / المسافرون",
        people1: "شخص واحد",
        people2: "شخصان",
        people3: "3 أشخاص",
        people4: "4 أشخاص",
        people5: "5 أشخاص أو أكثر",
      },
      prototypeNote:
        "واجهة البحث جاهزة. ستظهر الأسعار والتوافر الفعلي هنا بعد ربط واجهة travel API.",
      routesEyebrow: "مسارات MASTEROTA",
      routesTitle: "من مسار التسوق إلى مسار العطلة.",
      routesText:
        "يعمل قسم السفر بشكل منفصل عن المتجر، بينما يبقى الحساب واللغة والدفع تحت مظلة Masterota.",
      cards: {
        antalya: {
          badge: "رائج",
          title: "مسار أنطاليا",
          text: "فنادق شاطئية وخدمات نقل وتجارب صيفية.",
        },
        istanbul: {
          badge: "مدينة",
          title: "مسار إسطنبول",
          text: "فنادق المدينة والرحلات الجوية والأنشطة المختارة.",
        },
        freedom: {
          badge: "قريباً",
          title: "مسار الحرية",
          text: "استأجر سيارة وأنشئ مسارك الخاص.",
        },
      },
      exploreRoute: "استكشف المسار",
    },
  },
  zh: {
    navLabel: "旅行",
    page: {
      onlineTravelAgency: "在线旅行社",
      pill: "Masterota Travel",
      heroTitle: "在一个平台",
      heroAccent: "规划整段旅程。",
      heroText:
        "查找酒店、规划航班、租赁汽车并添加旅行体验。未来可在同一平台使用银行卡或加密货币完成全部安排。",
      trustSecure: "安全预订基础设施",
      trustPayment: "银行卡与 Web3 支付愿景",
      servicesLabel: "旅行服务",
      services: {
        hotels: {
          label: "酒店",
          eyebrow: "找到你的住宿路线",
          title: "你想去哪里？",
          locationLabel: "目的地",
          locationPlaceholder: "安塔利亚、伊斯坦布尔、罗马...",
          button: "搜索酒店",
        },
        flights: {
          label: "航班",
          eyebrow: "规划你的飞行路线",
          title: "下一段旅程从哪里开始？",
          locationLabel: "出发地和目的地",
          locationPlaceholder: "安塔利亚 → 莫斯科",
          button: "搜索航班",
        },
        cars: {
          label: "租车",
          eyebrow: "让旅程更加自由",
          title: "你想在哪里取车？",
          locationLabel: "取车地点",
          locationPlaceholder: "安塔利亚机场",
          button: "搜索车辆",
        },
        activities: {
          label: "玩乐活动",
          eyebrow: "真正探索一座城市",
          title: "你想在哪座城市寻找体验？",
          locationLabel: "城市或地区",
          locationPlaceholder: "卡帕多奇亚、迪拜、普吉岛...",
          button: "搜索活动",
        },
      },
      search: {
        start: "开始日期",
        end: "结束日期",
        guests: "住客 / 乘客",
        people1: "1 人",
        people2: "2 人",
        people3: "3 人",
        people4: "4 人",
        people5: "5 人以上",
      },
      prototypeNote:
        "搜索界面已准备完成。接入旅行 API 后，实时价格和可订状态将在这里显示。",
      routesEyebrow: "MASTEROTA 路线",
      routesTitle: "从购物路线到度假路线。",
      routesText:
        "旅行板块与商店独立运行，账户、语言和支付体验仍统一在 Masterota 平台中。",
      cards: {
        antalya: {
          badge: "热门",
          title: "安塔利亚路线",
          text: "海滨酒店、接送服务和夏日体验。",
        },
        istanbul: {
          badge: "城市",
          title: "伊斯坦布尔路线",
          text: "城市酒店、航班和精选活动。",
        },
        freedom: {
          badge: "即将上线",
          title: "自由路线",
          text: "租一辆车，创建属于自己的路线。",
        },
      },
      exploreRoute: "探索路线",
    },
  },
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content, "utf8");
}

function patchLocale(code, { navLabel, page }) {
  const relativePath = `src/i18n/locales/${code}.js`;
  let source = read(relativePath);

  if (!source.includes("    travel:")) {
    source = source.replace(
      /(  nav: \{[\s\S]*?    cart: "[^"]+",\n)(  \},\n  header:)/,
      `$1    travel: ${JSON.stringify(navLabel)},\n$2`,
    );
  }

  if (!source.includes("  travelPage:")) {
    const serialized = JSON.stringify(page, null, 2)
      .split("\n")
      .map((line, index) => (index === 0 ? line : `  ${line}`))
      .join("\n");

    source = source.replace(
      "  search: {",
      `  travelPage: ${serialized},\n  search: {`,
    );
  }

  write(relativePath, source);
}

function patchApp() {
  const relativePath = "src/App.jsx";
  let source = read(relativePath);

  if (!source.includes('import Travel from "./pages/Travel";')) {
    source = source.replace(
      'import CustomerAccount from "./pages/CustomerAccount";',
      'import CustomerAccount from "./pages/CustomerAccount";\nimport Travel from "./pages/Travel";',
    );
  }

  if (!source.includes('path="/travel"')) {
    source = source.replace(
      '          <Route path="/account/*" element={<CustomerAccount />} />',
      '          <Route path="/travel" element={<Travel />} />\n          <Route path="/account/*" element={<CustomerAccount />} />',
    );
  }

  write(relativePath, source);
}

function patchHeader() {
  const relativePath = "src/components/Header/Header.jsx";
  let source = read(relativePath);

  if (!source.includes('to="/travel"')) {
    const productsLink = /([ \t]*<NavLink\n[ \t]*to="\/products"[\s\S]*?\{t\("nav\.products"\)\}[\s\S]*?<\/NavLink>\n)/;
    const match = source.match(productsLink);

    if (!match) {
      throw new Error("Products navigation link could not be found in Header.jsx");
    }

    const travelLink = `\n            <NavLink\n              to="/travel"\n              className={({ isActive }) => (isActive ? "active" : "")}\n            >\n              {t("nav.travel")}\n            </NavLink>\n`;

    source = source.replace(productsLink, `$1${travelLink}`);
  }

  write(relativePath, source);
}

patchApp();
patchHeader();
Object.entries(translations).forEach(([code, data]) => patchLocale(code, data));

for (const relativePath of [scriptPath, workflowPath]) {
  const absolutePath = path.join(root, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

console.log("Travel route, header navigation and five-language i18n were added.");
