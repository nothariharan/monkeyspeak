// Static word pools — no logic

/** Simplest words — short, high-frequency, monosyllabic or bisyllabic. For easy mode. */
export const EASY_WORDS: string[] = [
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'is', 'it',
  'be', 'and', 'or', 'but', 'by', 'for', 'as', 'not', 'so', 'up',
  'he', 'she', 'we', 'you', 'me', 'us', 'my', 'his', 'her', 'its',
  'go', 'get', 'use', 'say', 'see', 'do', 'can', 'may', 'let',
  'big', 'new', 'old', 'top', 'one', 'two', 'own', 'far', 'few',
  'day', 'way', 'too', 'now', 'how', 'who', 'why', 'when', 'then',
  'just', 'like', 'make', 'take', 'give', 'keep', 'turn', 'look',
  'know', 'feel', 'want', 'need', 'mean', 'call', 'will', 'come',
  'back', 'hand', 'door', 'life', 'year', 'good', 'time', 'work',
  'help', 'hold', 'high', 'long', 'much', 'real', 'only', 'best',
  'find', 'even', 'play', 'show', 'move', 'next', 'stay', 'love',
  'win', 'run', 'fly', 'sit', 'try', 'put', 'hit', 'set', 'cut',
]

export const COMMON_WORDS: string[] = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'great', 'between', 'need',
  'large', 'often', 'hand', 'high', 'place', 'hold', 'turn', 'help',
  'much', 'before', 'line', 'right', 'too', 'mean', 'old', 'any', 'same',
  'tell', 'boy', 'follow', 'came', 'want', 'show', 'also', 'around',
  'form', 'small', 'set', 'put', 'end', 'does', 'another', 'well',
  'large', 'big', 'down', 'never', 'start', 'city', 'earth', 'eye',
  'light', 'picture', 'play', 'spell', 'air', 'away', 'animal', 'house',
  'point', 'page', 'letter', 'mother', 'answer', 'found', 'study',
  'still', 'learn', 'should', 'America', 'world', 'something', 'thought',
  'both', 'few', 'those', 'always', 'looked', 'show', 'large', 'often',
  'together', 'next', 'white', 'children', 'begin', 'got', 'walk',
  'example', 'ease', 'paper', 'group', 'always', 'music', 'those',
  'both', 'mark', 'book', 'carry', 'took', 'science', 'eat', 'room',
  'friend', 'began', 'idea', 'fish', 'mountain', 'stop', 'once', 'base',
  'hear', 'horse', 'cut', 'sure', 'watch', 'color', 'face', 'wood',
  'main', 'open', 'seem', 'together', 'next', 'white', 'children',
  'side', 'feet', 'car', 'mile', 'night', 'walk', 'north', 'plan',
  'story', 'once', 'might', 'star', 'close', 'seem', 'hard', 'open',
  'grow', 'four', 'call', 'late', 'five', 'door', 'real', 'fact',
  'hour', 'best', 'sure', 'true', 'during', 'body', 'music', 'color',
]

export const TECHNICAL_WORDS: string[] = [
  'function', 'return', 'export', 'import', 'component', 'interface',
  'render', 'state', 'props', 'async', 'await', 'fetch', 'response',
  'request', 'server', 'client', 'database', 'query', 'schema', 'model',
  'deploy', 'build', 'config', 'token', 'header', 'payload', 'endpoint',
  'stream', 'buffer', 'socket', 'network', 'latency', 'cache', 'index',
  'array', 'object', 'string', 'boolean', 'number', 'null', 'undefined',
  'promise', 'callback', 'event', 'listener', 'handler', 'middleware',
  'pipeline', 'container', 'instance', 'method', 'class', 'module',
  'package', 'version', 'branch', 'commit', 'merge', 'review', 'issue',
  'ticket', 'sprint', 'release', 'staging', 'production', 'monitor',
  'metric', 'alert', 'log', 'error', 'debug', 'test', 'coverage',
  'integration', 'unit', 'mock', 'fixture', 'assertion', 'spec',
]

export const HARD_WORDS: string[] = [
  'specifically', 'particularly', 'simultaneously', 'enthusiastically',
  'sophisticated', 'particularly', 'characteristic', 'philosophical',
  'revolutionary', 'approximately', 'predominantly', 'consecutively',
  'subsequently', 'comprehensively', 'systematically', 'perpendicular',
  'preliminary', 'extraordinary', 'simultaneously', 'responsibility',
  'authentication', 'implementation', 'infrastructure', 'visualisation',
  'differentiation', 'prioritisation', 'collaboration', 'acceleration',
  'communication', 'configuration', 'consideration', 'determination',
  'documentation', 'functionality', 'identification', 'interpretation',
  'methodology', 'optimisation', 'personalisation', 'representation',
]

export const NUMBER_WORDS: string[] = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'half', 'quarter', 'third', 'double', 'triple', 'zero', 'point', 'percent',
  'plus', 'minus', 'times', 'divided', 'equals', 'approximately', 'roughly',
]
