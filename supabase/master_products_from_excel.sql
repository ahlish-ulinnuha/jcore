-- Generated from /Users/bytedance/Downloads/Master Data-2.xlsx
-- Sheet: master product
-- Inserts brands, products, and product-to-vendor mappings.

with source_data(product_name, brand_name, vendor_id) as (
  values
    ('fish tofu mini', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso salmon', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue ikan fish', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('shrimp roll', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish cake', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso daging', 'GOOD EAT', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish roll cheese', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue ikan kukus QQ', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('flower twister', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish bar mini', 'GOOD EAT', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso mercon', 'VIGO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso lobster', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue ikan rasa pedas', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling dimsum ikan', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('chikuwa', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso jamur', 'GOOD EAT', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling spicy cheese', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish and soy', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso keju', 'SS', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('chikuwa long', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('cilok', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('vegekado', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling keju', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng', 'PAKDEN', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('ceker', 'NOBRAND', 'd9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'),
    ('sayap', 'NOBRAND', 'd9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'),
    ('fish tofu mini', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso udang', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis mini keju', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dump ayam', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso ikan', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('ekor udang', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tulangan', 'NOBRAND', 'd9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'),
    ('enoki', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis mini', 'BARTOZ', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('shrimp fish stick', 'PAKDEN', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('scalop', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('duo twister', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dfp', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tahu baso', 'MM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('squid cake roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling spicy chicken', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('otak2 singapore', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish roll lobster', 'INDOMINA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('chicken cake roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('steak salju', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso sayur', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis bambu', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('balado telur', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('shrimp cake roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kornet', 'SALAM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso ayam', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dump ayam prem', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kembang cumi', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso cumi', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso jumbo', 'BERKAH ABADI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('crab stick', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dump keju prem', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('korean fish (odeng tusuk)', 'FIESTA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng ilm', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odengeng lebar spicy', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tempura', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis jumbo', 'SAMS', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish cake roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('bintang', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tempura kotak', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('suki kotak', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng lebar', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('bintang kecil', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('vigie cake roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish tofu', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('twister ikan', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso ikan stick', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis ayam', 'GEBOY', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso sandwich', 'MOONFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dump tomyam', 'MOONFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kepiting analog', 'MOONFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue ikan jepang', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue kepiting', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tahu tuna', 'NAVAR BHARI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('udang ayam roll', 'MARKI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('ikan kukus filament', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('fish roll', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tisu kecil', 'JOLLY', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tisu besar', 'JOLLY', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('jamur salju', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('gula', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('nori boom', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('susu evaporasi', 'SUNBAY', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kresek bawang', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kembang tahu', 'IP', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('keju prochiz', 'PROCHIZ', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('korean fish', 'FIESTA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis mini sams', 'SAMS', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('korean fish odeng', 'FIESTA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tahu bakso', 'MM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sawi hijau', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('sawi putih', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('telur ayam', 'NOBRAND', 'd9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'),
    ('jamur enoki', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sirup strobery', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('teh pucuk', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('cuanki lidah', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('cuanki tahu', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('sunlight', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('sirup leci', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('le mineral', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('siomay kering', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('stella', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('mie menjangan', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('opp 11x11', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('opp 10x10', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('opp 15x15', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('ctik 4x6', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('ctik 6x10', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('ctik 5x8', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('cup kecil', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('trash bag', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('cetik 7x10', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('cup besar', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('kresek merah', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('daia', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('cool time', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('garam', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('lemon grass', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('good day', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('perasa lemon', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('pakcoy', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('kencur', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('cendol', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('thinwall', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('paper bowl', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('sendok', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('kertas kentang', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('kertas snack', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('plastik sayur', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('nori roll', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('jeruk limau', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('double tape', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('buah asem', 'NOBRAND', 'aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'),
    ('nipis madu', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('bolpoin', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('mie instant', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('plastik lilin', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('sticker', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('totole', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('masako', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('kerupuk mawar warna', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk bawang warna', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk bawang kuning', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk bawang putih', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk bintang', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk mawar putih', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk tangga', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('kerupuk taro', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('makaroni', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('makaroni spiral', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('makaroni kerang', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('mie telur', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('bihun', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('mie soun', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('spaghetti', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('tic tac', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('telur puyuh', 'NOBRAND', 'd9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'),
    ('pilus cikur', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('tofu roll', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('nori gulung', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('nori tabur', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('kerupuk stick potato', 'NOBRAND', '4b5a4baa-d137-474c-9ac4-5920c1623d09'),
    ('bihunku', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('cimol kering', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('cup cappucino', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('sterofoam', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('tempura stick', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('lumpia udang ayam', 'MARKI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tissue napkin', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('skm', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('wadah kentang', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('bihun padamu', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('cirawang', 'NOBRAND', 'cba28038-9a5d-4e95-b49b-e5de142c9f4d'),
    ('sosis keju', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis keju mini', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sosis mini sm', 'SAMS', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng gizi', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('otak-otak singapore', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('⁠baso ayam', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng indomina', 'INDOMINA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling ayam', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tissue besar', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tissue kecil', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('saos tomat sachet', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('cumi indomina', 'INDOMINA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng pakden', 'PAKDEN', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('bebek', 'INDOMINA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('otak-otak mini', 'PAKDEN', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tahu ikan', 'MOONFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sedotan', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling keju premium', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tempura burger', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('odeng lebar spicy', 'GIZI', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('evaporasi', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling dimsum', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso ikan mercon', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('otak-otak pakden', 'PAKDEN', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kerupuk bawang bintang', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('dumpling spicy chicken', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('siomay basah', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kaki gurita', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('narutomaki', 'SUNFISH', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('solasi fresh', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('solasi thank you', 'NOBRAND', '6224c04a-8c7b-43d5-b04a-1673328ba03b'),
    ('gelas cup reguler', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('saos tomat', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('saos sambal', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('makaroni pipa', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tempura premium', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tisu kecil', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('tisu besar', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('mie kuda menjangan', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('chikuwa cedea', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('sedotan plastik', 'NOBRAND', '62894ceb-1958-4f50-aed7-d824d2a19b08'),
    ('cumi', 'INDOMINA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('chicken roll', 'ILM', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kwetiau kering', 'NOBRAND', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('baso ikan pedas', 'SHIFUDO', 'd5b38434-75c1-46b6-bcfc-c934597f29ec'),
    ('kue ikan pedas', 'CEDEA', 'd5b38434-75c1-46b6-bcfc-c934597f29ec')
), normalized as (
  select
    trim(product_name) as product_name,
    upper(trim(brand_name)) as brand_name,
    vendor_id::uuid as vendor_id
  from source_data
  where trim(product_name) <> ''
), inserted_brands as (
  insert into public.brands (name, is_active)
  select distinct brand_name, true
  from normalized
  on conflict (name) do update set is_active = excluded.is_active
  returning id, name
), all_brands as (
  select id, name from public.brands
), product_source as (
  select distinct n.product_name, b.id as brand_id
  from normalized n
  join all_brands b on b.name = n.brand_name
), inserted_products as (
  insert into public.products (brand_id, sku, name, unit, is_active)
  select ps.brand_id, null, ps.product_name, 'pcs', true
  from product_source ps
  where not exists (
    select 1
    from public.products p
    where lower(trim(p.name)) = lower(trim(ps.product_name))
      and coalesce(p.brand_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(ps.brand_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  returning id, name, brand_id
), all_products as (
  select id, name, brand_id from public.products
), mapping_source as (
  select distinct p.id as product_id, n.vendor_id
  from normalized n
  join all_brands b on b.name = n.brand_name
  join all_products p
    on lower(trim(p.name)) = lower(trim(n.product_name))
   and coalesce(p.brand_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(b.id, '00000000-0000-0000-0000-000000000000'::uuid)
  join public.vendors v on v.id = n.vendor_id
)
insert into public.product_vendors (product_id, vendor_id, is_default)
select product_id, vendor_id, true
from mapping_source
on conflict (product_id, vendor_id) do update set
  is_default = excluded.is_default;

-- Optional check: vendor IDs from Excel that are not found in public.vendors.
with source_vendor_ids(vendor_id) as (
  values
    ('4b5a4baa-d137-474c-9ac4-5920c1623d09'::uuid),
    ('6224c04a-8c7b-43d5-b04a-1673328ba03b'::uuid),
    ('62894ceb-1958-4f50-aed7-d824d2a19b08'::uuid),
    ('aaaf95e9-b5a6-4dcd-8ed5-bb805c2a8955'::uuid),
    ('cba28038-9a5d-4e95-b49b-e5de142c9f4d'::uuid),
    ('d5b38434-75c1-46b6-bcfc-c934597f29ec'::uuid),
    ('d9184da5-29c7-40e3-a5f9-98b6dd8c3e1c'::uuid)
)
select svi.vendor_id as missing_vendor_id
from source_vendor_ids svi
left join public.vendors v on v.id = svi.vendor_id
where v.id is null;
