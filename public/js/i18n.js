const TRANSLATIONS = {
    ro: {
        // Nav
        nav_home:       'Acasă',
        nav_collection: 'Colecție',
        nav_contact:    'Contact',
        nav_back:       '← Înapoi la magazin',
        nav_back_short: '← Înapoi',
        theme_dark:     'Temă întunecată',
        theme_light:    'Temă deschisă',

        // Hero
        hero_subtitle:  'Artă Naturală',
        hero_title1:    'Emoții care',
        hero_title2:    'Înfloresc.',
        hero_desc:      'Cele mai proaspete flori, aranjate cu stil pentru tine.',
        hero_cta:       'Vezi Colecția',
        hero_contact:   'Contactează-ne',

        // Why us
        why_title:      'De ce noi?',
        why_1_title:    'Prospețime',
        why_1_desc:     'Florile noastre vin direct de la producători, proaspete în fiecare dimineață.',
        why_2_title:    'Livrare Rapidă',
        why_2_desc:     'Comanzi acum, și în câteva ore florile sunt la ușa ta.',
        why_3_title:    'Design Unic',
        why_3_desc:     'Fiecare buchet este o operă de artă, creat cu pasiune.',

        // Shop
        shop_title:     'Colecția 2026',
        filter_all:     'Toate',
        filter_exotic:  'Exotice',
        filter_classic: 'Clasice',
        filter_elegant: 'Elegante',
        filter_mix:     'Mix',
        add_to_cart:    'Adaugă în coș',
        in_cart:        'În Coș',

        // Services
        services_title:  'Universul Cadourilor',
        services_desc:   'Pentru că o floare vine rareori singură. Completează cadoul perfect.',
        service_1_title: 'Baloane cu Heliu',
        service_1_desc:  'Ridică ștacheta petrecerii! Avem baloane în toate formele și culorile pentru momente festive.',
        service_2_title: 'Suvenire',
        service_2_desc:  'Suveniruri speciale și amintiri de neuitat care păstrează magia fiecărui moment. Cadoul perfect pentru a duce bucuria mai departe.',
        service_3_title: 'Cutii Surpriză',
        service_3_desc:  'Combinația fatală: flori proaspete, dulciuri fine și mici atenții, toate într-o cutie elegantă.',

        // Cart
        cart_title:     'Coșul Tău',
        cart_empty:     'Coșul este gol.',
        cart_total:     'Total:',
        cart_checkout:  'Finalizează Comanda',
        cart_see_products: 'Vezi produsele',
        cart_add_notif: 'Adaugă ceva frumos.',

        // Modal
        modal_family:   'Familie:',
        modal_desc:     'Descriere:',
        modal_care:     'Îngrijire:',
        modal_note:     'Nota:',
        modal_add:      'Adaugă în coș',
        modal_add_more: 'Mai adaugă unu',
        modal_3d:       'Vezi în 3D (360°)',
        modal_rotate:   'Rotește și mărește',

        // Product modal text
        product_1_desc: 'O explozie de culoare tropicala care rezista luni intregi. E blana pentru living.',
        product_1_care: 'Udare în rozeta centrală, lumină indirectă.',
        product_1_note: 'Nu necesită sol clasic, e o plantă epifită.',
        product_2_desc: 'Anthurium Lilli este o plantă elegantă, cu frunze verzi lucioase și flori roșii sau roz.',
        product_2_care: 'Preferă lumină indirectă, umiditate ridicată și udare moderată.',
        product_2_note: 'Poate înflori pe tot parcursul anului în condiții potrivite.',
        product_3_desc: 'Miroase a nobilime si arata scump. Cadoul clasic care nu da gres.',
        product_3_care: 'Pământ bine drenat, soare plin.',
        product_3_note: 'Atenție la polen, poate păta hainele.',
        product_4_desc: 'Regina florilor. Simbolul perfecțiunii.',
        product_4_care: 'Scufundare o dată pe săptămână, lumină filtrată.',
        product_4_note: 'Nu tăia tijele verzi după înflorire.',
        product_5_desc: 'Frumusete care nu moare. E scump dar merita toti banii.',
        product_5_care: 'Nu necesită apă! Feriți de soare direct.',
        product_5_note: 'Rezistă până la 25 de ani.',
        product_6_desc: 'Amestec de flori de crocus în culori variate.',
        product_6_care: 'Preferă sol bine drenat, poziție însorită sau semi-umbrită, și necesită udare moderată.',
        product_6_note: 'Ideal pentru borduri, peluze și ghivece decorative.',
        product_7_desc: 'Una dintre cele mai populare plante de apartament.',
        product_7_care: 'Lumină multă, udare rară lasă pământul să se usuce complet între udări.',
        product_7_note: 'Rezistentă și robustă, ideală pentru începători.',
        product_8_desc: 'Floarea mireaselor. Parfumul ei dulce și florile albe o fac alegerea perfectă pentru ocazii speciale.',
        product_8_care: 'Lumină indirectă puternică, umiditate constantă, temperaturi stabile.',
        product_8_note: 'Sensibilă la curenți de aer și schimbări bruște de temperatură.',
        product_9_desc: 'Exotică și fără sol crește în aer liber.',
        product_9_care: 'Pulverizare de 2-3 ori pe săptămână, fără sol, fixată pe suport sau scoarță.',
        product_9_note: 'Plantă epifită nu are nevoie de ghiveci cu pământ.',
        product_10_desc: 'Planta de indestructibilă supraviețuiește în orice condiții.',
        product_10_care: 'Tolerează lumină redusă și udare rară. Udă o dată la 2-3 săptămâni.',
        product_10_note: 'Una dintre puținele plante care rezistă și la întuneric total.',
        product_11_desc: 'Plantă perenă cu frunze verzi lucioase și floare albă în formă de pâlnie.',
        product_11_care: 'Lumină puternică indirectă, sol bine drenat și udat regulat, umiditate moderată.',
        product_11_note: 'Înflorește primăvara–vara, părți ușor toxice dacă sunt ingerate.',
        product_12_desc: 'Lilium Mix este un amestec de crini cu flori mari și parfumate, de diverse culori.',
        product_12_care: 'Preferă lumină indirectă și umiditate moderată.',
        product_12_note: 'Ideală pentru decorarea interioarelor datorită aspectului său exotic și întreținerii ușoare.',

        // Checkout
        checkout_title:   'Finalizare Comandă',
        checkout_total:   'Total de plată:',
        checkout_payment: 'Plata se face la livrare (ramburs).',
        label_name:       'Nume Prenume',
        label_phone:      'Telefon',
        label_email:      'Email (Opțional)',
        label_address:    'Adresa de Livrare',
        ph_name:          'Ex: Ion Popescu',
        ph_phone:         '069 123 456',
        ph_email:         'ion@email.com',
        ph_address:       'Strada, Număr, Oraș...',
        btn_submit:       'Trimite Comanda',
        btn_sending:      'Se trimite...',
        btn_retry:        'Încearcă iar',
        btn_native_pay:   'Achită cu GPay',

        // Contact
        contact_title:    'Contactează-ne',
        contact_desc:     'Ai întrebări? Suntem aici să te ajutăm cu orice detaliu despre flori.',
        contact_phone:    'Telefon',
        contact_location: 'Locație',
        contact_location_val: 'Cărpineni, Moldova',
        label_your_name:  'Numele Tău',
        label_message:    'Mesajul Tău',
        ph_your_name:     'Cum te cheamă?',
        ph_message:       'Cu ce te putem ajuta?',
        btn_send:         'Trimite Mesaj',
        btn_sending2:     'Se trimite...',

        // Footer
        footer: '© 2026 Florăria Cărpineni.',

        // Notificationsssss
        notif_added:    'Am adăugat "{name}" în coș!',
        notif_more:     'Ai mai pus o {name}! ({qty})',
        notif_removed:  'Produs eliminat din coș',
        notif_empty:    'Coșul este gol! Adaugă ceva frumos.',
        notif_cart_err: 'Eroare la salvarea coșului',
        notif_link_copied: 'Link copiat!',
    },

    en: {
        nav_home:       'Home',
        nav_collection: 'Collection',
        nav_contact:    'Contact',
        nav_back:       '← Back to shop',
        nav_back_short: '← Back',
        theme_dark:     'Dark theme',
        theme_light:    'Light theme',

        hero_subtitle:  'Natural Art',
        hero_title1:    'Emotions that',
        hero_title2:    'Blossom.',
        hero_desc:      'The freshest flowers, arranged with style just for you.',
        hero_cta:       'See Collection',
        hero_contact:   'Contact Us',

        why_title:      'Why us?',
        why_1_title:    'Freshness',
        why_1_desc:     'Our flowers come directly from growers, fresh every morning.',
        why_2_title:    'Fast Delivery',
        why_2_desc:     'Order now, and within hours the flowers are at your door.',
        why_3_title:    'Unique Design',
        why_3_desc:     'Every bouquet is a work of art, created with passion.',

        shop_title:     'Collection 2026',
        filter_all:     'All',
        filter_exotic:  'Exotic',
        filter_classic: 'Classic',
        filter_elegant: 'Elegant',
        filter_mix:     'Mix',
        add_to_cart:    'Add to Cart',
        in_cart:        'In Cart',

        services_title:  'The Gift Universe',
        services_desc:   'Because a flower rarely comes alone. Complete the perfect gift.',
        service_1_title: 'Helium Balloons',
        service_1_desc:  'Raise the party bar! We have balloons in all shapes and colors for festive moments.',
        service_2_title: 'Souvenirs',
        service_2_desc:  'Special souvenirs and unforgettable memories that preserve the magic of every moment. The perfect gift to carry the joy forward.',
        service_3_title: 'Surprise Boxes',
        service_3_desc:  'The perfect combo: fresh flowers, fine sweets and little extras, all in an elegant box.',

        cart_title:     'Your Cart',
        cart_empty:     'Your cart is empty.',
        cart_total:     'Total:',
        cart_checkout:  'Checkout',
        cart_see_products: 'See products',
        cart_add_notif: 'Add something beautiful.',

        modal_family:   'Family:',
        modal_desc:     'Description:',
        modal_care:     'Care:',
        modal_note:     'Note:',
        modal_add:      'Add to Cart',
        modal_add_more: 'Add one more',
        modal_3d:       'View in 3D (360°)',
        modal_rotate:   'Rotate & zoom',

        product_1_desc: 'A burst of tropical color that lasts for months. Looks great in the living room.',
        product_1_care: 'Water in the central rosette, indirect light.',
        product_1_note: 'Does not need classic soil; it is an epiphyte plant.',
        product_2_desc: 'Anthurium Lilli is an elegant plant with glossy green leaves and red or pink flowers.',
        product_2_care: 'Prefers indirect light, high humidity and moderate watering.',
        product_2_note: 'Can bloom all year round in the right conditions.',
        product_3_desc: 'Smells royal and looks expensive. The classic gift that does not miss.',
        product_3_care: 'Well-drained soil, full sun.',
        product_3_note: 'Careful with the pollen, it can stain clothes.',
        product_4_desc: 'The queen of flowers. A symbol of perfection.',
        product_4_care: 'Dip watering once a week, filtered light.',
        product_4_note: 'Do not cut the green stems after flowering.',
        product_5_desc: 'Beauty that does not give up. Expensive, but worth the money.',
        product_5_care: 'Does not need water! Keep away from direct sun.',
        product_5_note: 'Can last up to 25 years.',
        product_6_desc: 'A mix of crocus flowers in varied colors.',
        product_6_care: 'Prefers well-drained soil, sunny or semi-shaded position, and moderate watering.',
        product_6_note: 'Ideal for borders, lawns and decorative pots.',
        product_7_desc: 'One of the most popular indoor plants.',
        product_7_care: 'Plenty of light, rare watering; let the soil dry completely between waterings.',
        product_7_note: 'Strong and resistant, ideal for beginners.',
        product_8_desc: 'The bridal flower. Its sweet perfume and white flowers make it perfect for special occasions.',
        product_8_care: 'Strong indirect light, constant humidity, stable temperatures.',
        product_8_note: 'Sensitive to drafts and sudden temperature changes.',
        product_9_desc: 'Exotic and soil-free, it grows in open air.',
        product_9_care: 'Spray 2-3 times per week, no soil, fixed on support or bark.',
        product_9_note: 'An epiphyte plant, it does not need a pot with soil.',
        product_10_desc: 'The indestructible plant; survives almost anything.',
        product_10_care: 'Tolerates low light and rare watering. Water once every 2-3 weeks.',
        product_10_note: 'One of the few plants that can handle very dark corners too.',
        product_11_desc: 'A perennial plant with glossy green leaves and a white funnel-shaped flower.',
        product_11_care: 'Bright indirect light, well-drained soil, regular watering and moderate humidity.',
        product_11_note: 'Blooms in spring-summer; parts are mildly toxic if eaten.',
        product_12_desc: 'Lilium Mix is a blend of lilies with large, fragrant flowers in different colors.',
        product_12_care: 'Prefers indirect light and moderate humidity.',
        product_12_note: 'Ideal for indoor decoration thanks to its exotic look and easy care.',

        checkout_title:   'Checkout',
        checkout_total:   'Total to pay:',
        checkout_payment: 'Payment on delivery (cash on delivery).',
        label_name:       'Full Name',
        label_phone:      'Phone',
        label_email:      'Email (Optional)',
        label_address:    'Delivery Address',
        ph_name:          'Ex: John Smith',
        ph_phone:         '069 123 456',
        ph_email:         'john@email.com',
        ph_address:       'Street, Number, City...',
        btn_submit:       'Place Order',
        btn_sending:      'Sending...',
        btn_retry:        'Try again',
        btn_native_pay:   'Pay with GPay',

        // Contact
        contact_title:    'Contact Us',
        contact_desc:     'Have questions? We\'re here to help with any detail about flowers.',
        contact_phone:    'Phone',
        contact_location: 'Location',
        contact_location_val: 'Cărpineni, Moldova',
        label_your_name:  'Your Name',
        label_message:    'Your Message',
        ph_your_name:     'What\'s your name?',
        ph_message:       'How can we help you?',
        btn_send:         'Send Message',
        btn_sending2:     'Sending...',

        footer: '© 2026 Florăria Cărpineni.',

        notif_added:    'Added "{name}" to cart!',
        notif_more:     'Added another {name}! ({qty})',
        notif_removed:  'Item removed from cart',
        notif_empty:    'Cart is empty! Add something beautiful.',
        notif_cart_err: 'Error saving cart',
        notif_link_copied: 'Link copied!',
    },

    ru: {
        nav_home:       'Главная',
        nav_collection: 'Коллекция',
        nav_contact:    'Контакт',
        nav_back:       '← Назад в магазин',
        nav_back_short: '← Назад',
        theme_dark:     'Тёмная тема',
        theme_light:    'Светлая тема',

        hero_subtitle:  'Природное Искусство',
        hero_title1:    'Эмоции которые',
        hero_title2:    'Расцветают.',
        hero_desc:      'Самые свежие цветы, стильно оформленные для вас.',
        hero_cta:       'Смотреть Коллекцию',
        hero_contact:   'Связаться с нами',

        why_title:      'Почему мы?',
        why_1_title:    'Свежесть',
        why_1_desc:     'Наши цветы поступают прямо от производителей, свежие каждое утро.',
        why_2_title:    'Быстрая Доставка',
        why_2_desc:     'Заказывайте сейчас, и через несколько часов цветы будут у вашей двери.',
        why_3_title:    'Уникальный Дизайн',
        why_3_desc:     'Каждый букет — произведение искусства, созданное с любовью.',

        shop_title:     'Коллекция 2026',
        filter_all:     'Все',
        filter_exotic:  'Экзотика',
        filter_classic: 'Классика',
        filter_elegant: 'Элегантность',
        filter_mix:     'Микс',
        add_to_cart:    'В корзину',
        in_cart:        'В корзине',

        services_title:  'Вселенная Подарков',
        services_desc:   'Потому что цветок редко приходит один. Дополни идеальный подарок.',
        service_1_title: 'Шары с гелием',
        service_1_desc:  'Подними планку праздника! Шары всех форм и цветов для торжественных моментов.',
        service_2_title: 'Cувениры',
        service_2_desc:  'Особые сувениры и незабываемые воспоминания, сохраняющие волшебство каждого момента. Идеальный подарок, чтобы сохранить радость навсегда.',
        service_3_title: 'Коробки-сюрпризы',
        service_3_desc:  'Идеальная комбинация: свежие цветы, изысканные сладости и маленькие сюрпризы в элегантной коробке.',

        cart_title:     'Ваша Корзина',
        cart_empty:     'Корзина пуста.',
        cart_total:     'Итого:',
        cart_checkout:  'Оформить Заказ',
        cart_see_products: 'Смотреть товары',
        cart_add_notif: 'Добавьте что-нибудь красивое.',

        modal_family:   'Семейство:',
        modal_desc:     'Описание:',
        modal_care:     'Уход:',
        modal_note:     'Примечание:',
        modal_add:      'В корзину',
        modal_add_more: 'Добавить ещё',
        modal_3d:       'Смотреть в 3D (360°)',
        modal_rotate:   'Вращайте и масштабируйте',

        product_1_desc: 'Взрыв тропического цвета, который держится месяцами. Для гостиной прям отлично.',
        product_1_care: 'Полив в центральную розетку, рассеянный свет.',
        product_1_note: 'Не требует классической почвы, это эпифитное растение.',
        product_2_desc: 'Anthurium Lilli - элегантное растение с глянцевыми зелеными листьями и красными или розовыми цветами.',
        product_2_care: 'Предпочитает рассеянный свет, высокую влажность и умеренный полив.',
        product_2_note: 'При подходящих условиях может цвести круглый год.',
        product_3_desc: 'Пахнет по-королевски и выглядит дорого. Классический подарок, который не подводит.',
        product_3_care: 'Хорошо дренированная почва, полное солнце.',
        product_3_note: 'Осторожно с пыльцой, она может испачкать одежду.',
        product_4_desc: 'Королева цветов. Символ совершенства.',
        product_4_care: 'Погружной полив раз в неделю, фильтрованный свет.',
        product_4_note: 'Не срезайте зеленые цветоносы после цветения.',
        product_5_desc: 'Красота, которая не сдается. Дорого, но своих денег стоит.',
        product_5_care: 'Не требует воды! Беречь от прямого солнца.',
        product_5_note: 'Может жить до 25 лет.',
        product_6_desc: 'Смесь крокусов разных цветов.',
        product_6_care: 'Предпочитает хорошо дренированную почву, солнце или полутень и умеренный полив.',
        product_6_note: 'Идеально для бордюров, газонов и декоративных горшков.',
        product_7_desc: 'Одно из самых популярных комнатных растений.',
        product_7_care: 'Много света, редкий полив; давайте почве полностью высохнуть между поливами.',
        product_7_note: 'Крепкое и выносливое, идеально для начинающих.',
        product_8_desc: 'Цветок невест. Сладкий аромат и белые цветы делают его идеальным для особых случаев.',
        product_8_care: 'Яркий рассеянный свет, постоянная влажность, стабильная температура.',
        product_8_note: 'Чувствителен к сквознякам и резким перепадам температуры.',
        product_9_desc: 'Экзотическое растение без почвы, растет прямо в воздухе.',
        product_9_care: 'Опрыскивать 2-3 раза в неделю, без почвы, закрепить на опоре или коре.',
        product_9_note: 'Эпифитное растение, ему не нужен горшок с землей.',
        product_10_desc: 'Практически неубиваемое растение, выживает почти в любых условиях.',
        product_10_care: 'Переносит слабый свет и редкий полив. Поливать раз в 2-3 недели.',
        product_10_note: 'Одно из немногих растений, которое выдерживает даже очень темные места.',
        product_11_desc: 'Многолетнее растение с глянцевыми зелеными листьями и белым цветком в форме воронки.',
        product_11_care: 'Яркий рассеянный свет, хорошо дренированная почва, регулярный полив и умеренная влажность.',
        product_11_note: 'Цветет весной-летом; части растения слегка токсичны при употреблении.',
        product_12_desc: 'Lilium Mix - смесь лилий с крупными ароматными цветами разных оттенков.',
        product_12_care: 'Предпочитает рассеянный свет и умеренную влажность.',
        product_12_note: 'Идеально для интерьера благодаря экзотическому виду и легкому уходу.',

        checkout_title:   'Оформление Заказа',
        checkout_total:   'Сумма к оплате:',
        checkout_payment: 'Оплата при доставке (наложенный платёж).',
        label_name:       'Имя и Фамилия',
        label_phone:      'Телефон',
        label_email:      'Email (Необязательно)',
        label_address:    'Адрес Доставки',
        ph_name:          'Напр: Иван Петров',
        ph_phone:         '069 123 456',
        ph_email:         'ivan@email.com',
        ph_address:       'Улица, Номер, Город...',
        btn_submit:       'Отправить Заказ',
        btn_sending:      'Отправляется...',
        btn_retry:        'Попробовать снова',
        btn_native_pay:   'Оплата с GPay',

        // Contact
        contact_title:    'Свяжитесь с нами',
        contact_desc:     'Есть вопросы? Мы здесь, чтобы помочь с любыми деталями о цветах.',
        contact_phone:    'Телефон',
        contact_location: 'Местоположение',
        contact_location_val: 'Кэрпинень, Молдова',
        label_your_name:  'Ваше Имя',
        label_message:    'Ваше Сообщение',
        ph_your_name:     'Как вас зовут?',
        ph_message:       'Как мы можем помочь?',
        btn_send:         'Отправить',
        btn_sending2:     'Отправляется...',

        footer: '© 2026 Florăria Cărpineni.',

        notif_added:    '"{name}" добавлен в корзину!',
        notif_more:     'Ещё один {name}! ({qty})',
        notif_removed:  'Товар удалён из корзины',
        notif_empty:    'Корзина пуста! Добавьте что-нибудь красивое.',
        notif_cart_err: 'Ошибка сохранения корзины',
        notif_link_copied: 'Ссылка скопирована!',
    }
};

const LANG_NAMES = { ro: 'RO', en: 'EN', ru: 'RU' };

function detectLang() {
    const saved = localStorage.getItem('lb_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
    const browser = (navigator.language || navigator.userLanguage || 'ro').slice(0, 2).toLowerCase();
    if (browser === 'ru') return 'ru';
    if (browser === 'en') return 'en';
    return 'ro';
}

function t(key, vars = {}) {
    const lang = window.__lang || 'ro';
    let str = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS['ro'][key] || key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    return str;
}

function hasTranslation(key, lang = window.__lang || 'ro') {
    return Boolean(TRANSLATIONS[lang] && Object.prototype.hasOwnProperty.call(TRANSLATIONS[lang], key));
}

function setLang(lang) {
    // Check if View Transitions are supported
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            applyLangChange(lang);
        });
    } else {
        // Fallback to old cross-fade if no view transitions
        document.body.classList.add('lang-switching');
        setTimeout(() => {
            applyLangChange(lang);
            setTimeout(() => {
                document.body.classList.remove('lang-switching');
            }, 50);
        }, 250);
    }
}

function applyTheme(theme) {
    if (!theme) theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    const isDark = theme === 'dark';
    const currentLang = typeof detectLang === 'function' ? detectLang() : (localStorage.getItem('lb_lang') || 'ro');
    const themeLabelKey = isDark ? 'theme_dark' : 'theme_light';
    const apply = () => {
         document.documentElement.setAttribute('data-theme', theme);
         localStorage.setItem('lb_theme', theme);
         document.querySelectorAll('.theme-pill, .theme-pill[data-active]').forEach(pill => {
             pill.classList.toggle('active', isDark);
             pill.setAttribute('data-active', isDark ? 'true' : 'false');
         });
         document.querySelectorAll('.lb-sheet-theme-label').forEach(label => {
             label.textContent = t(themeLabelKey);
         });
     };
    if (document.startViewTransition) {
        document.startViewTransition(apply);
    } else {
        apply();
    }
}

function applyLangChange(lang) {
    window.__lang = lang;
    localStorage.setItem('lb_lang', lang);
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const attr = el.dataset.i18nAttr;
        if (attr) { el.setAttribute(attr, t(key)); }
        else { el.textContent = t(key); }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPh);
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    if (typeof window.onLangChange === 'function') window.onLangChange(lang);
}

function initLang() {
    window.__lang = detectLang();
    setLang(window.__lang);
}
