"""The name, unit and group of every number in the three norm files (spec 2026-11-15), as the admin
panel shows them. tests/test_norm_overrides.py checks every number in the files is here or in
UNUSED, so a norm cannot be added without its name."""
from __future__ import annotations

S, SM, SD, SM2, SKG, SQ = "so'm", "so'm/m", "so'm/dona", "so'm/m²", "so'm/kg", "so'm/qop"

PIPES = "Santexnika: quvur va fitinglar"
PARTS = "Santexnika: qismlar"
WORK = "Santexnika: ishlar"
DEMO = "Santexnika: demontaj va shtroba"
HEATER = "Santexnika: suv isitgich (boyler)"
SLOPE = "Santexnika: trap va qiyalik"
TILE = "Plitka va gidroizolyatsiya"
APRON = "Oshxona fartugi"
RAIL = "Sochiq quritgich"
FAN = "Ventilyator"
ELEC = "Rozetka va kabel"

CATALOG: dict[str, dict[str, tuple[str, str, str]]] = {
    "plumbing": {
        "pipe_m_uzs.drain_50": ("Kanalizatsiya quvuri Ø50", SM, PIPES),
        "pipe_m_uzs.drain_110": ("Kanalizatsiya quvuri Ø110", SM, PIPES),
        "pipe_m_uzs.water_20": ("Suv quvuri PPR Ø20", SM, PIPES),
        "fitting_uzs.tee_20": ("Uchlik Ø20", SD, PIPES),
        "fitting_uzs.elbow_20": ("Burchak Ø20", SD, PIPES),
        "fitting_uzs.outlet_20": ("Suv rozetkasi Ø20", SD, PIPES),
        "fitting_uzs.valve_20": ("Sharli kran Ø20", SD, PIPES),
        "fitting_uzs.tee_50": ("Uchlik Ø50", SD, PIPES),
        "fitting_uzs.elbow_50": ("Burchak Ø50", SD, PIPES),
        "fitting_uzs.tee_110_50": ("Uchlik Ø110/50", SD, PIPES),
        "fitting_uzs.elbow_110": ("Burchak Ø110", SD, PIPES),
        "part_uzs.smesitel_rakovina": ("Rakovina smesiteli", SD, PARTS),
        "part_uzs.smesitel_oshxona": ("Oshxona smesiteli", SD, PARTS),
        "part_uzs.smesitel_vanna": ("Vanna va dush smesiteli", SD, PARTS),
        "part_uzs.smesitel_dush": ("Dush smesiteli", SD, PARTS),
        "part_uzs.smesitel_bide": ("Gigiyenik smesitel (bide)", SD, PARTS),
        "part_uzs.sifon_rakovina": ("Rakovina sifoni", SD, PARTS),
        "part_uzs.sifon_oshxona": ("Oshxona sifoni", SD, PARTS),
        "part_uzs.sifon_vanna": ("Vanna sifoni", SD, PARTS),
        "part_uzs.sifon_dush": ("Dush poddoni sifoni", SD, PARTS),
        "part_uzs.gofra_unitaz": ("Unitaz gofrasi", SD, PARTS),
        "part_uzs.podvodka": ("Shlang (podvodka)", SD, PARTS),
        "part_uzs.installyatsiya": ("Installyatsiya (osma unitaz ramasi)", SD, PARTS),
        "part_uzs.kran_kir": ("Kir yuvish mashinasi krani", SD, PARTS),
        "part_uzs.sifon_kir": ("Kir yuvish mashinasi sifoni", SD, PARTS),
        "part_uzs.trap_pol": ("Pol trapi", SD, PARTS),
        "part_uzs.hisoblagich_suv": ("Suv hisoblagichi", SD, PARTS),
        "part_uzs.filtr_suv": ("Dag'al filtr", SD, PARTS),
        "part_uzs.reduktor": ("Bosim reduktori", SD, PARTS),
        "part_uzs.klapan_teskari": ("Teskari klapan", SD, PARTS),
        "part_uzs.gipsokarton_nam": ("Namga chidamli gipsokarton (quti)", SD, PARTS),
        "work_point_uzs": ("Ish: nuqtani ulash", SD, WORK),
        "work_mixer_uzs": ("Ish: smesitel o'rnatish", SD, WORK),
        "work_frame_uzs": ("Ish: installyatsiya o'rnatish", SD, WORK),
        "frame_box.profile_m": ("Gipsokarton quti profili (bir unitazga)", "m", WORK),
        "frame_box.work_uzs": ("Ish: gipsokarton quti yig'ish", SD, WORK),
        "work_washer_uzs": ("Ish: kir yuvish mashinasini ulash", SD, WORK),
        "work_water_inlet_uzs": ("Ish: suv kirish uzelini yig'ish", "so'm/liniya", WORK),
        "work_fixture_uzs.bathtub": ("Ish: vanna o'rnatish", SD, WORK),
        "work_fixture_uzs.sink": ("Ish: rakovina o'rnatish", SD, WORK),
        "work_fixture_uzs.toilet": ("Ish: unitaz o'rnatish", SD, WORK),
        "work_fixture_uzs.shower": ("Ish: dush o'rnatish", SD, WORK),
        "work_fixture_uzs.bidet": ("Ish: bide o'rnatish", SD, WORK),
        "work_demolition_fixture_uzs.bathtub": ("Demontaj: vanna", SD, DEMO),
        "work_demolition_fixture_uzs.shower": ("Demontaj: dush", SD, DEMO),
        "work_demolition_fixture_uzs.toilet": ("Demontaj: unitaz", SD, DEMO),
        "work_demolition_fixture_uzs.sink": ("Demontaj: rakovina", SD, DEMO),
        "work_demolition_fixture_uzs.bidet": ("Demontaj: bide", SD, DEMO),
        "work_demolition_pipes_uzs": ("Demontaj: eski quvurlar (xona uchun)", "so'm/komplekt", DEMO),
        "work_chase_m_uzs.water_20": ("Shtroba: suv quvuri", SM, DEMO),
        "work_chase_m_uzs.drain_50": ("Shtroba: kanalizatsiya Ø50", SM, DEMO),
        "water_heater.heater_uzs": ("Suv isitgich (boyler)", SD, HEATER),
        "water_heater.kit_uzs": ("Boyler ulash to'plami", "so'm/komplekt", HEATER),
        "water_heater.cable_m": ("Boyler kabeli uzunligi", "m", HEATER),
        "water_heater.work_uzs": ("Ish: boyler o'rnatish", SD, HEATER),
        "work_floor_drain_uzs": ("Ish: trap o'rnatish", SD, SLOPE),
        "floor_slope.mix_kg_m2": ("Qiyalik styajkasi sarfi", "kg/m²", SLOPE),
        "floor_slope.bag_kg": ("Styajka qopi og'irligi", "kg", SLOPE),
        "floor_slope.bag_uzs": ("Styajka qopi narxi", SQ, SLOPE),
        "floor_slope.work_m2_uzs": ("Ish: dush zonasini trapga qiyalatish", SM2, SLOPE),
    },
    "tile": {
        "adhesive_kg_m2": ("Plitka yelimi sarfi", "kg/m²", TILE),
        "adhesive_bag_kg": ("Plitka yelimi qopi og'irligi", "kg", TILE),
        "adhesive_bag_uzs": ("Plitka yelimi qopi narxi", SQ, TILE),
        "grout_kg_m2": ("Zatirka sarfi", "kg/m²", TILE),
        "grout_pack_kg": ("Zatirka qadog'i og'irligi", "kg", TILE),
        "grout_pack_uzs": ("Zatirka qadog'i narxi", "so'm/qadoq", TILE),
        "wall_tile_m2_uzs": ("Devor plitkasi (do'konda yo'q bo'lsa)", SM2, TILE),
        "work_floor_m2_uzs": ("Ish: pol plitkasini terish", SM2, TILE),
        "work_wall_m2_uzs": ("Ish: devor plitkasini terish", SM2, TILE),
        "mastic_kg_m2": ("Gidroizolyatsiya mastikasi sarfi", "kg/m²", TILE),
        "mastic_kg_uzs": ("Gidroizolyatsiya mastikasi", SKG, TILE),
        "tape_m_uzs": ("Gidroizolyatsiya lentasi", SM, TILE),
        "work_waterproof_m2_uzs": ("Ish: gidroizolyatsiya", SM2, TILE),
        "work_backsplash_m2_uzs": ("Ish: fartuk plitkasini terish", SM2, APRON),
        "skinali_m2_uzs": ("Skinali (shisha fartuk)", SM2, APRON),
        "work_skinali_m2_uzs": ("Ish: skinali o'rnatish", SM2, APRON),
    },
    "bathroom_extras": {
        "towel_rail_uzs_by_size.500x500": ("Sochiq quritgich 50×50 (suvli)", SD, RAIL),
        "towel_rail_uzs_by_size.500x600": ("Sochiq quritgich 50×60 (suvli)", SD, RAIL),
        "towel_rail_uzs_by_size.500x800": ("Sochiq quritgich 50×80 (suvli)", SD, RAIL),
        "towel_rail_uzs_by_size.600x800": ("Sochiq quritgich 60×80 (suvli)", SD, RAIL),
        "towel_rail_uzs_by_size.600x1000": ("Sochiq quritgich 60×100 (suvli)", SD, RAIL),
        "el_towel_rail_uzs_by_size.500x500": ("Sochiq quritgich 50×50 (elektr)", SD, RAIL),
        "el_towel_rail_uzs_by_size.500x600": ("Sochiq quritgich 50×60 (elektr)", SD, RAIL),
        "el_towel_rail_uzs_by_size.500x800": ("Sochiq quritgich 50×80 (elektr)", SD, RAIL),
        "el_towel_rail_uzs_by_size.600x800": ("Sochiq quritgich 60×80 (elektr)", SD, RAIL),
        "el_towel_rail_uzs_by_size.600x1000": ("Sochiq quritgich 60×100 (elektr)", SD, RAIL),
        "work_towel_rail_uzs": ("Ish: suvli sochiq quritgichni o'rnatish", SD, RAIL),
        "work_el_towel_rail_uzs": ("Ish: elektr sochiq quritgichni o'rnatish", SD, RAIL),
        "fan_uzs_by_size.100": ("Tortuvchi ventilyator Ø100", SD, FAN),
        "fan_uzs_by_size.125": ("Tortuvchi ventilyator Ø125", SD, FAN),
        "fan_uzs_by_size.150": ("Tortuvchi ventilyator Ø150", SD, FAN),
        "fan_air_changes": ("Havo almashinuvi (soatiga necha marta)", "marta/soat", FAN),
        "work_fan_uzs": ("Ish: ventilyatorni o'rnatish", SD, FAN),
        "fan_cable_m": ("Ventilyator kabeli uzunligi", "m", FAN),
        "socket_ip44_uzs": ("Namga chidamli rozetka (IP44)", SD, ELEC),
        "el_rail_cable_m": ("Elektr sochiq quritgich kabeli uzunligi", "m", ELEC),
        "washer_cable_m": ("Kir yuvish mashinasi kabeli uzunligi", "m", ELEC),
        "work_washer_socket_uzs": ("Ish: kir yuvish mashinasi rozetkasini o'rnatish", SD, ELEC),
    },
}

# Numbers still in a file but no longer read: superseded by the by-size prices (2026-11-15).
UNUSED: dict[str, tuple[str, ...]] = {
    "bathroom_extras": ("towel_rail_uzs", "el_towel_rail_uzs", "fan_uzs"),
}
