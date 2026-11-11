import {
  Sprout, Sun, CalendarDays, Users, BookOpen, Leaf, Zap, Scale, Moon, Camera, Search, CircleCheck,
  Hourglass, Droplet, FlaskConical, Thermometer, Pencil, Microscope, Scissors, Lightbulb, Flower,
  Flower2, Bean, TreeDeciduous, Wind, Amphora, Trophy, ShowerHead, Share, SquarePlus, X,
} from "lucide-react";

// The app's one icon set: drawn line icons instead of emoji, so every phone shows the same thing.
// Icons are picked by name because planner.js (no React) names the icon for each stage and milestone.
// water / feed / photo / env / note match the grow log types.
const ICONS = {
  sprout: Sprout, sun: Sun, calendar: CalendarDays, users: Users, book: BookOpen, leaf: Leaf,
  zap: Zap, scale: Scale, moon: Moon, search: Search, check: CircleCheck, hourglass: Hourglass,
  water: Droplet, feed: FlaskConical, photo: Camera, env: Thermometer, note: Pencil,
  microscope: Microscope, scissors: Scissors, bulb: Lightbulb, flower: Flower, flower2: Flower2,
  bean: Bean, tree: TreeDeciduous, wind: Wind, jar: Amphora, trophy: Trophy, shower: ShowerHead,
  share: Share, add: SquarePlus, close: X,
};

export default function Icon({ name, size = 18 }) {
  const Drawn = ICONS[name];
  return Drawn ? <Drawn className="tv-ic" size={size} strokeWidth={1.75} aria-hidden="true" /> : null;
}

// An icon on a soft amber tile, for the big choices and banners.
export const Tile = ({ name }) => <span className="tv-icon-tile"><Icon name={name} size={22} /></span>;
