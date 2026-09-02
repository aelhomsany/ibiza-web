import { getBrowserTimezone } from '../../auth/timezone'

/**
 * ISO 3166-1 alpha-2 country codes for the registration country field.
 *
 * Only the codes are stored. `Intl.DisplayNames` supplies the names in the reader's own
 * language, so adding Arabic — or any future locale — costs nothing and the list can never
 * drift out of sync with the translations the way a hand-maintained name table would.
 */
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const

/**
 * IANA time-zone → ISO country, derived from the tzdata shipped with the OS.
 *
 * Keyed by the zone's last path segment, which is unique across all of them — storing `Cairo`
 * rather than `Africa/Cairo` is what keeps this inside the public bundle's byte budget.
 *
 * Legacy aliases are included deliberately: Chrome reports `Asia/Calcutta`, not `Asia/Kolkata`,
 * even on a machine set to the modern name, so a canonical-only table would send every Indian
 * visitor to whatever their browser language implies. Aliases whose final segment is ambiguous
 * across countries (`US/Central` against `Canada/Central`) are left out, and browsers
 * canonicalise those anyway. A zone the table does not know falls through to the next signal.
 */
const ZONE_COUNTRIES = `
  ACT:AU Abidjan:CI Accra:GH Acre:BR Adak:US Addis_Ababa:ET Adelaide:AU Aden:YE Alaska:US
  Aleutian:US Algiers:DZ Almaty:KZ Amman:JO Amsterdam:NL Anadyr:RU Anchorage:US Andorra:AD
  Anguilla:AI Antananarivo:MG Antigua:AG Apia:WS Aqtau:KZ Aqtobe:KZ Araguaina:BR Aruba:AW
  Ashgabat:TM Ashkhabad:TM Asmara:ER Astrakhan:RU Asuncion:PY Athens:GR Atikokan:CA Atka:US
  Atlantic:CA Atyrau:KZ Auckland:NZ Azores:PT Baghdad:IQ Bahia:BR Bahia_Banderas:MX Bahrain:BH
  BajaNorte:MX BajaSur:MX Baku:AZ Bamako:ML Bangkok:TH Bangui:CF Banjul:GM Barbados:BB
  Barnaul:RU Beirut:LB Belem:BR Belgrade:RS Belize:BZ Berlin:DE Bermuda:BM Beulah:US Bishkek:KG
  Bissau:GW Blanc-Sablon:CA Blantyre:MW Boa_Vista:BR Bogota:CO Boise:US Bougainville:PG
  Bratislava:SK Brazzaville:CG Brisbane:AU Broken_Hill:AU Brunei:BN Brussels:BE Bucharest:RO
  Budapest:HU Buenos_Aires:AR Bujumbura:BI Busingen:DE Cairo:EG Calcutta:IN Cambridge_Bay:CA
  Campo_Grande:BR Canary:ES Canberra:AU Cancun:MX Cape_Verde:CV Caracas:VE Casablanca:MA
  Casey:AQ Catamarca:AR Cayenne:GF Cayman:KY Center:US Ceuta:ES Chagos:IO Chatham:NZ Chicago:US
  Chihuahua:MX Chisinau:MD Chita:RU Choibalsan:MN Chongqing:CN Christmas:CX Chungking:CN
  Chuuk:FM Ciudad_Juarez:MX Cocos:CC Colombo:LK ComodRivadavia:AR Comoro:KM Conakry:GN
  Continental:CL Copenhagen:DK Cordoba:AR Costa_Rica:CR Coyhaique:CL Creston:CA Cuiaba:BR
  Curacao:CW Currie:AU Dacca:BD Dakar:SN Damascus:SY Danmarkshavn:GL Dar_es_Salaam:TZ Darwin:AU
  Davis:AQ Dawson:CA Dawson_Creek:CA DeNoronha:BR Denver:US Detroit:US Dhaka:BD Dili:TL
  Djibouti:DJ Dominica:DM Douala:CM Dubai:AE Dublin:IE DumontDUrville:AQ Dushanbe:TJ East:BR
  East-Indiana:US Easter:CL EasterIsland:CL Eastern:US Edmonton:CA Efate:VU Eirunepe:BR
  El_Aaiun:EH El_Salvador:SV Enderbury:KI Ensenada:MX Eucla:AU Faeroe:FO Fakaofo:TK Famagusta:CY
  Faroe:FO Fiji:FJ Fort_Nelson:CA Fort_Wayne:US Fortaleza:BR Freetown:SL Funafuti:TV Gaborone:BW
  Galapagos:EC Gambier:PF Gaza:PS General:MX Gibraltar:GI Glace_Bay:CA Godthab:GL Goose_Bay:CA
  Grand_Turk:TC Grenada:GD Guadalcanal:SB Guadeloupe:GP Guam:GU Guatemala:GT Guayaquil:EC
  Guernsey:GG Guyana:GY Halifax:CA Harare:ZW Harbin:CN Havana:CU Hawaii:US Hebron:PS Helsinki:FI
  Hermosillo:MX Ho_Chi_Minh:VN Hobart:AU Hong_Kong:HK Honolulu:US Hovd:MN Indiana-Starke:US
  Indianapolis:US Inuvik:CA Iqaluit:CA Irkutsk:RU Isle_of_Man:IM Istanbul:TR Jakarta:ID
  Jamaica:JM Jayapura:ID Jersey:JE Jerusalem:IL Johannesburg:ZA Johnston:US Juba:SS Jujuy:AR
  Juneau:US Kabul:AF Kaliningrad:RU Kamchatka:RU Kampala:UG Kanton:KI Karachi:PK Kashgar:CN
  Kathmandu:NP Katmandu:NP Kerguelen:TF Khandyga:RU Khartoum:SD Kiev:UA Kigali:RW Kinshasa:CD
  Kiritimati:KI Kirov:RU Knox:US Knox_IN:US Kolkata:IN Kosrae:FM Kralendijk:BQ Krasnoyarsk:RU
  Kuala_Lumpur:MY Kuching:MY Kuwait:KW Kwajalein:MH Kyiv:UA LHI:AU La_Paz:BO La_Rioja:AR
  Lagos:NG Libreville:GA Lima:PE Lindeman:AU Lisbon:PT Ljubljana:SI Lome:TG London:GB
  Longyearbyen:SJ Lord_Howe:AU Los_Angeles:US Louisville:US Lower_Princes:SX Luanda:AO
  Lubumbashi:CD Lusaka:ZM Luxembourg:LU Macao:MO Macau:MO Maceio:BR Macquarie:AU Madeira:PT
  Madrid:ES Magadan:RU Mahe:SC Majuro:MH Makassar:ID Malabo:GQ Maldives:MV Malta:MT Managua:NI
  Manaus:BR Manila:PH Maputo:MZ Marengo:US Mariehamn:AX Marigot:MF Marquesas:PF Martinique:MQ
  Maseru:LS Matamoros:MX Mauritius:MU Mawson:AQ Mayotte:YT Mazatlan:MX Mbabane:SZ McMurdo:AQ
  Melbourne:AU Mendoza:AR Menominee:US Merida:MX Metlakatla:US Mexico_City:MX Michigan:US
  Midway:UM Minsk:BY Miquelon:PM Mogadishu:SO Monaco:MC Moncton:CA Monrovia:LR Monterrey:MX
  Montevideo:UY Monticello:US Montserrat:MS Moscow:RU Muscat:OM NSW:AU Nairobi:KE Nassau:BS
  Nauru:NR Ndjamena:TD New_Salem:US New_York:US Newfoundland:CA Niamey:NE Nicosia:CY Niue:NU
  Nome:US Norfolk:NF Noronha:BR North:AU Nouakchott:MR Noumea:NC Novokuznetsk:RU Novosibirsk:RU
  Nuuk:GL Ojinaga:MX Omsk:RU Oral:KZ Oslo:NO Ouagadougou:BF Pago_Pago:AS Palau:PW Palmer:AQ
  Panama:PA Pangnirtung:CA Paramaribo:SR Paris:FR Perth:AU Petersburg:US Phnom_Penh:KH
  Phoenix:US Pitcairn:PN Podgorica:ME Pohnpei:FM Pontianak:ID Port-au-Prince:HT Port_Moresby:PG
  Port_of_Spain:TT Porto-Novo:BJ Porto_Acre:BR Porto_Velho:BR Prague:CZ Puerto_Rico:PR
  Punta_Arenas:CL Pyongyang:KP Qatar:QA Qostanay:KZ Queensland:AU Qyzylorda:KZ Rainy_River:CA
  Rangoon:MM Rankin_Inlet:CA Rarotonga:CK Recife:BR Regina:CA Resolute:CA Reunion:RE
  Reykjavik:IS Riga:LV Rio_Branco:BR Rio_Gallegos:AR Riyadh:SA Rome:IT Rosario:AR Rothera:AQ
  Saigon:VN Saipan:MP Sakhalin:RU Salta:AR Samara:RU Samarkand:UZ San_Juan:AR San_Luis:AR
  San_Marino:SM Santa_Isabel:MX Santarem:BR Santiago:CL Santo_Domingo:DO Sao_Paulo:BR
  Sao_Tome:ST Sarajevo:BA Saratov:RU Saskatchewan:CA Scoresbysund:GL Seoul:KR Shanghai:CN
  Shiprock:US Simferopol:UA Singapore:SG Sitka:US Skopje:MK Sofia:BG South:AU South_Georgia:GS
  South_Pole:AQ Srednekolymsk:RU St_Barthelemy:BL St_Helena:SH St_Johns:CA St_Kitts:KN
  St_Lucia:LC St_Thomas:VI St_Vincent:VC Stanley:FK Stockholm:SE Swift_Current:CA Sydney:AU
  Syowa:AQ Tahiti:PF Taipei:TW Tallinn:EE Tarawa:KI Tashkent:UZ Tasmania:AU Tbilisi:GE
  Tegucigalpa:HN Tehran:IR Tel_Aviv:IL Tell_City:US Thimbu:BT Thimphu:BT Thule:GL Tijuana:MX
  Tirane:AL Tiraspol:MD Tokyo:JP Tomsk:RU Tongatapu:TO Toronto:CA Tortola:VG Tripoli:LY Troll:AQ
  Tucuman:AR Tunis:TN Ujung_Pandang:ID Ulaanbaatar:MN Ulan_Bator:MN Ulyanovsk:RU Urumqi:CN
  Ushuaia:AR Ust-Nera:RU Uzhgorod:UA Vaduz:LI Vancouver:CA Vatican:VA Vevay:US Victoria:AU
  Vienna:AT Vientiane:LA Vilnius:LT Vincennes:US Vladivostok:RU Volgograd:RU Vostok:AQ Wake:UM
  Wallis:WF Warsaw:PL Whitehorse:CA Winamac:US Windhoek:NA Winnipeg:CA Yakutat:US Yakutsk:RU
  Yancowinna:AU Yangon:MM Yekaterinburg:RU Yellowknife:CA Yerevan:AM Yukon:CA Zagreb:HR
  Zaporozhye:UA Zurich:CH
`

export type CountryOption = { code: string; name: string }

/**
 * Codes paired with their localized names, ordered the way the reader's language orders words —
 * `Intl.Collator` puts Egypt under E in English and مصر under م in Arabic, so a visitor scanning
 * the open list finds their country where they expect it rather than in English alphabetical order.
 */
export function countryOptions(locale: string): CountryOption[] {
  let display: Intl.DisplayNames | null = null
  try {
    display = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    display = null
  }
  const collator = new Intl.Collator(locale)
  return COUNTRY_CODES.map((code) => ({
    code,
    // A runtime that has the region data but not this particular code returns the code itself,
    // which is still a usable label rather than a blank row.
    name: display?.of(code) ?? code,
  })).sort((left, right) => collator.compare(left.name, right.name))
}

let zoneIndex: Map<string, string> | null = null

/** The country whose tzdata claims this zone, or nothing for an alias the table predates. */
export function countryFromTimeZone(timeZone: string): string | undefined {
  zoneIndex ??= new Map(
    ZONE_COUNTRIES.trim()
      .split(/\s+/)
      .map((entry) => {
        const split = entry.lastIndexOf(':')
        return [entry.slice(0, split), entry.slice(split + 1)] as const
      }),
  )
  return zoneIndex.get(timeZone.split('/').pop() ?? '')
}

/**
 * Where the visitor is, guessed from the browser rather than asked for.
 *
 * The time zone is tried first because it is the only signal here that tracks the machine's
 * actual location: a developer in Cairo running an en-US browser is on `Africa/Cairo`, and asking
 * their declared languages instead would put them in the United States. Languages remain the
 * second attempt, for a zone this table predates.
 *
 * Neither is IP geolocation, which needs a country header from whatever fronts the deployment.
 * A third-party lookup is deliberately not called from here: it would be an unconsented
 * cross-origin request on a page that has not yet asked the visitor about analytics.
 */
export function inferCountryCode(fallback: string): string {
  const known = new Set<string>(COUNTRY_CODES)

  const zone = getBrowserTimezone()
  const located = zone === 'UTC' ? undefined : countryFromTimeZone(zone)
  if (located && known.has(located)) return located

  const declared =
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const tag of declared) {
    let region: string | undefined
    try {
      region = new Intl.Locale(tag).region ?? undefined
    } catch {
      region = undefined
    }
    if (region && known.has(region)) return region
  }
  return fallback
}
