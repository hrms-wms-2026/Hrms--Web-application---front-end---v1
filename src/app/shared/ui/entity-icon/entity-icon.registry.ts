import {
  Accessibility, Activity, AlarmClock, Ambulance, Anchor, Archive, AtSign, Atom, Award, Baby, Backpack, BadgeCheck, Bandage,
  Banknote, Battery, Bed, Bell, Bike, BookOpen, Bookmark, Bot, Boxes, Brain, Briefcase, Brush, Bug, Building, Cake, Calendar,
  CalendarCheck, CalendarDays, Camera, Car, ChartColumn, ChartLine, ChartPie, Church, ClipboardList, Clock, Cloud, CloudSun,
  Code, Coffee, Cog, Coins, Compass, Cpu, CreditCard, Cross, Crown, Database, Dna, Dumbbell, Factory, Feather, FileText, Film,
  Flag, Flame, FlaskConical, Flower2, Folder, FolderKanban, Footprints, Gauge, Gavel, Gem, Gift, Glasses, Globe, GraduationCap,
  Hammer, Hand, Handshake, Hash, Headset, Heart, HeartHandshake, HeartPulse, Hospital, Hourglass, House, Image as ImageIcon, Inbox, Infinity as InfinityIcon,
  Key, Landmark, Layers, Leaf, Library, LifeBuoy, Lightbulb, Link, ListChecks, Lock, Mail, Map as MapIcon, MapPin, Medal, Megaphone,
  MessageCircle, MessagesSquare, Mic, Microscope, Moon, Mountain, Newspaper, Package, Palette, PartyPopper, PenTool,
  PersonStanding, Phone, PiggyBank, Pill, Plane, Plug, Puzzle, Receipt, Recycle, Rocket, Scale, Send, Server, Settings, Shield,
  ShieldCheck, Ship, Shirt, ShoppingCart, Snowflake, Sofa, Sparkles, Sprout, SquareCheckBig, SquareKanban, Star, Stethoscope, Store, Sun,
  Syringe, Tag, Target, Tent, Terminal, Thermometer, ThumbsUp, Timer, TreePalm, TrendingUp, Trophy, Truck, Umbrella, UserPlus,
  UserRound, Users, UsersRound, Utensils, Video, Wallet, Wifi, Wrench, Zap
} from 'lucide';

/** One Lucide icon: [tag, attributes] children of a 24x24 stroke SVG. */
export type IconNode = readonly (readonly [string, Record<string, string | number | undefined>])[];

export interface EntityIconOption {
  /** Lucide's kebab-case name, the part after "lucide:". */
  readonly name: string;
  readonly node: IconNode;
  /** Extra search words beyond the name. */
  readonly keywords: string;
}

export interface EntityIconGroup {
  readonly label: string;
  readonly icons: readonly EntityIconOption[];
}

const icon = (name: string, node: IconNode, keywords = ''): EntityIconOption => ({ name, node, keywords });

/** The icons the picker offers, grouped. Curated rather than all ~1,600 so the picker stays browsable and the bundle small. */
export const ENTITY_ICON_GROUPS: readonly EntityIconGroup[] = [
  {
    label: 'Work',
    icons: [
      icon('briefcase', Briefcase, 'work job'), icon('rocket', Rocket, 'launch startup'), icon('target', Target, 'goal aim'),
      icon('flag', Flag, 'milestone'), icon('trophy', Trophy, 'win award'), icon('star', Star, 'favourite'),
      icon('zap', Zap, 'fast lightning'), icon('lightbulb', Lightbulb, 'idea'), icon('puzzle', Puzzle, 'integration'),
      icon('layers', Layers, 'stack'), icon('boxes', Boxes, 'modules'), icon('package', Package, 'box delivery'),
      icon('folder', Folder, 'files'), icon('folder-kanban', FolderKanban, 'project board'), icon('square-kanban', SquareKanban, 'board'),
      icon('clipboard-list', ClipboardList, 'tasks checklist'), icon('list-checks', ListChecks, 'todo'),
      icon('square-check-big', SquareCheckBig, 'task done tick'),
      icon('chart-column', ChartColumn, 'bar graph report'), icon('chart-line', ChartLine, 'graph trend'),
      icon('chart-pie', ChartPie, 'graph share'), icon('trending-up', TrendingUp, 'growth sales'), icon('gauge', Gauge, 'speed performance'),
      icon('building', Building, 'office company'), icon('factory', Factory, 'manufacturing plant'), icon('store', Store, 'shop retail'),
      icon('landmark', Landmark, 'bank government'), icon('scale', Scale, 'legal balance'), icon('gavel', Gavel, 'legal law'),
    ]
  },
  {
    label: 'Time',
    icons: [
      icon('calendar', Calendar, 'date'), icon('calendar-days', CalendarDays, 'date schedule'), icon('calendar-check', CalendarCheck, 'booked'),
      icon('clock', Clock, 'time hours'), icon('timer', Timer, 'stopwatch'), icon('hourglass', Hourglass, 'wait'),
      icon('alarm-clock', AlarmClock, 'reminder'),
    ]
  },
  {
    label: 'People',
    icons: [
      icon('users', Users, 'team group'), icon('users-round', UsersRound, 'team group'), icon('user-round', UserRound, 'person'),
      icon('user-plus', UserPlus, 'hire onboarding'), icon('handshake', Handshake, 'deal partner'),
      icon('heart-handshake', HeartHandshake, 'care support volunteer'), icon('person-standing', PersonStanding, 'person'),
      icon('baby', Baby, 'maternity paternity child'), icon('hand', Hand, 'wave'), icon('thumbs-up', ThumbsUp, 'like approve'),
      icon('accessibility', Accessibility, 'disability'), icon('footprints', Footprints, 'walk'),
    ]
  },
  {
    label: 'Communication',
    icons: [
      icon('messages-square', MessagesSquare, 'chat'), icon('message-circle', MessageCircle, 'chat'), icon('mail', Mail, 'email'),
      icon('send', Send, 'message'), icon('inbox', Inbox, 'mail'), icon('megaphone', Megaphone, 'announce marketing'),
      icon('bell', Bell, 'notify'), icon('headset', Headset, 'support help'), icon('phone', Phone, 'call'), icon('video', Video, 'meeting call'),
      icon('mic', Mic, 'podcast audio'), icon('at-sign', AtSign, 'mention'), icon('hash', Hash, 'channel'),
      icon('newspaper', Newspaper, 'news'), icon('life-buoy', LifeBuoy, 'help support'),
    ]
  },
  {
    label: 'Tech',
    icons: [
      icon('code', Code, 'developer'), icon('terminal', Terminal, 'cli'), icon('bug', Bug, 'issue qa'), icon('cpu', Cpu, 'chip'),
      icon('database', Database, 'data'), icon('server', Server, 'backend'), icon('cloud', Cloud, 'hosting'), icon('globe', Globe, 'web world'),
      icon('wifi', Wifi, 'network'), icon('bot', Bot, 'ai robot'), icon('shield', Shield, 'security'), icon('shield-check', ShieldCheck, 'secure'),
      icon('lock', Lock, 'private'), icon('key', Key, 'access'), icon('link', Link, 'url'), icon('plug', Plug, 'integration'),
      icon('battery', Battery, 'power'), icon('settings', Settings, 'gear'), icon('cog', Cog, 'gear'), icon('wrench', Wrench, 'tools fix'),
      icon('hammer', Hammer, 'build'),
    ]
  },
  {
    label: 'Creative',
    icons: [
      icon('pen-tool', PenTool, 'design'), icon('palette', Palette, 'design colour'), icon('brush', Brush, 'paint'),
      icon('camera', Camera, 'photo'), icon('image', ImageIcon, 'picture'), icon('film', Film, 'movie'), icon('sparkles', Sparkles, 'magic new'),
      icon('feather', Feather, 'write'), icon('book-open', BookOpen, 'read docs'), icon('graduation-cap', GraduationCap, 'study training learning'),
      icon('library', Library, 'books'), icon('file-text', FileText, 'document'), icon('bookmark', Bookmark, 'save'), icon('tag', Tag, 'label'),
      icon('archive', Archive, 'store'),
    ]
  },
  {
    label: 'Money',
    icons: [
      icon('wallet', Wallet, 'finance'), icon('credit-card', CreditCard, 'payment'), icon('banknote', Banknote, 'cash payroll'),
      icon('piggy-bank', PiggyBank, 'savings'), icon('coins', Coins, 'money'), icon('receipt', Receipt, 'expense invoice'),
      icon('shopping-cart', ShoppingCart, 'purchase'), icon('gift', Gift, 'bonus present'), icon('gem', Gem, 'premium'),
      icon('crown', Crown, 'vip'), icon('medal', Medal, 'award'), icon('award', Award, 'recognition'), icon('badge-check', BadgeCheck, 'verified'),
    ]
  },
  {
    label: 'Health',
    icons: [
      icon('heart', Heart, 'love care'), icon('heart-pulse', HeartPulse, 'health sick'), icon('activity', Activity, 'health'),
      icon('stethoscope', Stethoscope, 'doctor medical sick'), icon('hospital', Hospital, 'medical'), icon('pill', Pill, 'medicine sick'),
      icon('syringe', Syringe, 'vaccine'), icon('thermometer', Thermometer, 'fever sick'), icon('bandage', Bandage, 'injury'),
      icon('ambulance', Ambulance, 'emergency'), icon('cross', Cross, 'medical'), icon('brain', Brain, 'mental health'),
      icon('bed', Bed, 'rest sleep'), icon('dumbbell', Dumbbell, 'fitness gym'),
    ]
  },
  {
    label: 'Life & travel',
    icons: [
      icon('sun', Sun, 'holiday summer vacation'), icon('tree-palm', TreePalm, 'holiday beach vacation'), icon('umbrella', Umbrella, 'holiday'),
      icon('plane', Plane, 'travel trip flight'), icon('car', Car, 'drive travel'), icon('bike', Bike, 'cycle'), icon('ship', Ship, 'boat'),
      icon('truck', Truck, 'delivery logistics'), icon('map', MapIcon, 'travel'), icon('map-pin', MapPin, 'location'), icon('compass', Compass, 'explore'),
      icon('mountain', Mountain, 'outdoors'), icon('tent', Tent, 'camping'), icon('backpack', Backpack, 'travel school'),
      icon('house', House, 'home remote'), icon('sofa', Sofa, 'home rest'), icon('coffee', Coffee, 'break'), icon('utensils', Utensils, 'food lunch'),
      icon('cake', Cake, 'birthday'), icon('party-popper', PartyPopper, 'celebrate'), icon('church', Church, 'religious'),
      icon('moon', Moon, 'night religious'), icon('cloud-sun', CloudSun, 'weather'), icon('snowflake', Snowflake, 'winter'),
      icon('flame', Flame, 'hot'), icon('leaf', Leaf, 'nature green'), icon('sprout', Sprout, 'grow'), icon('flower-2', Flower2, 'nature'),
      icon('recycle', Recycle, 'green'), icon('anchor', Anchor, 'stable'), icon('shirt', Shirt, 'uniform'), icon('glasses', Glasses, 'read'),
    ]
  },
  {
    label: 'Science',
    icons: [
      icon('atom', Atom, 'science'), icon('flask-conical', FlaskConical, 'lab experiment'), icon('microscope', Microscope, 'research'),
      icon('dna', Dna, 'biology'), icon('infinity', InfinityIcon, 'forever'),
    ]
  },
];

const BY_NAME: ReadonlyMap<string, IconNode> = new Map(ENTITY_ICON_GROUPS.flatMap(g => g.icons.map(i => [i.name, i.node] as const)));

export const ENTITY_ICON_COLORS: readonly string[] = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#0EA5E9', '#3B82F6', '#64748B'
];

export type ParsedEntityIcon =
  | { readonly kind: 'lucide'; readonly name: string; readonly node: IconNode }
  | { readonly kind: 'emoji'; readonly emoji: string };

/** Reads a stored icon value ("lucide:{name}" / "emoji:{emoji}"); null for none, malformed or an icon this build doesn't offer. */
export function parseEntityIcon(value: string | null | undefined): ParsedEntityIcon | null {
  if (!value) return null;
  if (value.startsWith('lucide:')) {
    const name = value.slice('lucide:'.length);
    const node = BY_NAME.get(name);
    return node ? { kind: 'lucide', name, node } : null;
  }
  if (value.startsWith('emoji:')) {
    const emoji = value.slice('emoji:'.length);
    return emoji ? { kind: 'emoji', emoji } : null;
  }
  return null;
}

export function lucideIconValue(name: string): string {
  return `lucide:${name}`;
}

export function emojiIconValue(emoji: string): string {
  return `emoji:${emoji}`;
}
