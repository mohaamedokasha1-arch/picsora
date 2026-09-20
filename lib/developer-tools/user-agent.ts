/**
 * User-Agent string parser — identify browser, engine, OS and device class
 * with ordered regex rules. Pure functions; the reporting caveat (UA strings
 * are self-declared and often frozen) belongs in the UI copy.
 */

export interface UserAgentInfo {
  browser: string;
  browserVersion: string;
  engine: string;
  engineVersion: string;
  os: string;
  osVersion: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  isBot: boolean;
}

const UNKNOWN: UserAgentInfo = {
  browser: 'Unknown',
  browserVersion: '',
  engine: 'Unknown',
  engineVersion: '',
  os: 'Unknown',
  osVersion: '',
  device: 'unknown',
  isBot: false,
};

const BOTS = [
  'bot', 'crawl', 'spider', 'slurp', 'mediapartners', 'baidu', 'yandex', 'sogou',
  'exabot', 'facebot', 'ia_archiver', 'facebookexternalhit', 'linkedinbot',
  'twitterbot', 'embedly', 'quora', 'outbrain', 'pinterest', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'googlebot', 'bingbot', 'duckduckbot',
];

export function parseUserAgent(input: string): UserAgentInfo {
  const ua = (input || '').slice(0, 2000);
  if (!ua.trim()) return { ...UNKNOWN };
  const lower = ua.toLowerCase();

  const isBot = BOTS.some((b) => lower.includes(b));
  let device: UserAgentInfo['device'] = 'desktop';
  if (isBot) device = 'bot';
  else if (/ipad|tablet|playbook|silk(?!.*mobile)/i.test(ua)) device = 'tablet';
  else if (/mobi|android|iphone|ipod|windows phone|blackberry|opera mini/i.test(ua)) device = 'mobile';

  // Browser (order matters — every Chromium UA also contains Safari/AppleWebKit).
  let browser = 'Unknown';
  let browserVersion = '';
  const take = (m: RegExpMatchArray | null): string => (m && m[1] ? m[1].replace(/_/g, '.') : '');
  const edge = ua.match(/Edg(?:A|iOS)?\/([\d.]+)/);
  const opera = ua.match(/OPR\/([\d.]+)/) ?? ua.match(/Opera\/.*Version\/([\d.]+)/);
  const brave = /Brave\//.test(ua) ? ua.match(/Chrome\/([\d.]+)/) : null;
  const vivaldi = ua.match(/Vivaldi\/([\d.]+)/);
  const samsung = ua.match(/SamsungBrowser\/([\d.]+)/);
  const firefox = ua.match(/Firefox\/([\d.]+)/) ?? ua.match(/FxiOS\/([\d.]+)/);
  const chrome = ua.match(/Chrome\/([\d.]+)/) ?? ua.match(/CriOS\/([\d.]+)/);
  const safari = ua.match(/Version\/([\d.]+).*Safari\//);
  if (edge) {
    browser = 'Edge';
    browserVersion = take(edge);
  } else if (opera) {
    browser = 'Opera';
    browserVersion = take(opera);
  } else if (vivaldi) {
    browser = 'Vivaldi';
    browserVersion = take(vivaldi);
  } else if (samsung) {
    browser = 'Samsung Internet';
    browserVersion = take(samsung);
  } else if (brave) {
    browser = 'Brave';
    browserVersion = take(brave);
  } else if (firefox) {
    browser = 'Firefox';
    browserVersion = take(firefox);
  } else if (chrome && !safari) {
    browser = 'Chrome';
    browserVersion = take(chrome);
  } else if (safari) {
    browser = 'Safari';
    browserVersion = take(safari);
  } else if (/MSIE ([\d.]+)/.test(ua)) {
    browser = 'Internet Explorer';
    browserVersion = take(ua.match(/MSIE ([\d.]+)/));
  } else if (/Trident\/.*rv:([\d.]+)/.test(ua)) {
    browser = 'Internet Explorer';
    browserVersion = take(ua.match(/rv:([\d.]+)/));
  }

  // Engine.
  let engine = 'Unknown';
  let engineVersion = '';
  const appleWebKit = ua.match(/AppleWebKit\/([\d.]+)/);
  const gecko = ua.match(/Gecko\/([\d.]+)/);
  if (browser === 'Firefox') {
    engine = 'Gecko';
    engineVersion = take(gecko) || browserVersion;
  } else if (browser === 'Internet Explorer') {
    engine = 'Trident';
    engineVersion = take(ua.match(/Trident\/([\d.]+)/));
  } else if (appleWebKit) {
    engine = browser === 'Safari' ? 'WebKit' : 'Blink';
    engineVersion = take(appleWebKit);
  }

  // OS.
  let os = 'Unknown';
  let osVersion = '';
  const windows = ua.match(/Windows NT ([\d.]+)/);
  const mac = ua.match(/Mac OS X ([\d_]+)/);
  const ios = ua.match(/OS ([\d_]+) like Mac OS X/);
  const android = ua.match(/Android ([\d.]+)/);
  const linux = /Linux|X11/.test(ua);
  const chromeOs = /CrOS/.test(ua);
  if (windows) {
    os = 'Windows';
    const map: Record<string, string> = { '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    osVersion = map[take(windows)] ?? take(windows);
  } else if (ios && /iPhone|iPad|iPod/.test(ua)) {
    os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
    osVersion = take(ios);
  } else if (mac) {
    os = 'macOS';
    osVersion = take(mac);
  } else if (android) {
    os = 'Android';
    osVersion = take(android);
  } else if (chromeOs) {
    os = 'ChromeOS';
    osVersion = take(ua.match(/CrOS [\w_]+ ([\d.]+)/));
  } else if (linux) {
    os = 'Linux';
  }

  return { browser, browserVersion, engine, engineVersion, os, osVersion, device, isBot };
}
