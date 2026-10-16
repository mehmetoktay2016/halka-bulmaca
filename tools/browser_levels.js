// Bölümleri tarayıcıdakiyle birebir aynı yükler: logic.js, levels_data.js, levels.js aynı global alanda.
// Node'da require('../levels.js') önceden üretilmiş verileri görmez ve ortalama/ölçekleme (centered, fitted)
// tarayıcıdakinden farklı sonuç verir; tahtadaki konuma bakan araçlar (ödül yerleri) bunu kullanmalı.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function browserLevels() {
  const root = path.join(__dirname, '..');
  const ctx = { Math, JSON, Object, Array, Number, String, Map, Set, Date, Error };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['logic.js', 'levels_data.js', 'levels.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^var RING_LEVEL_DATA/m, 'this.RING_LEVEL_DATA'), ctx);
  }
  const Levels = ctx.RingLevels;
  return { Levels, Logic: ctx.RingLogic, getLevel: Levels.getLevel, order: Array.from(Levels.gateOrder(Levels.getLevel)) };
};
