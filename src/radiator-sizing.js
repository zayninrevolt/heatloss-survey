(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RadiatorSizing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function correctionFactor(deltaT, factors) {
    var value = Math.max(20, Math.min(65, Number(deltaT) || 0));
    var lower = Math.floor(value);
    var upper = Math.ceil(value);
    if (lower === upper) return factors[lower];
    return factors[lower] + (factors[upper] - factors[lower]) * (value - lower);
  }

  function output(model, width, factor) {
    if (!model) return 0;
    return model.wattsPerMetre * (Number(width) / 1000) * factor;
  }

  function sortOptions(options, filters) {
    filters = filters || {};
    return options.sort(function (a, b) {
      if (filters.preferredWidth) {
        var aDistance = Math.abs(a.width - filters.preferredWidth);
        var bDistance = Math.abs(b.width - filters.preferredWidth);
        if (aDistance !== bDistance) return aDistance - bDistance;
      }
      return a.height - b.height || a.width - b.width ||
        a.type.localeCompare(b.type) || a.size.localeCompare(b.size);
    });
  }

  function individualOptions(config) {
    config = config || {};
    var filters = config.filters || {};
    var options = [];
    (config.models || []).forEach(function (model) {
      if (config.newInstallation && model.height === 500) return;
      if (filters.maxHeight && model.height > filters.maxHeight) return;
      if (filters.panelType && filters.panelType !== 'Any' &&
          model.type !== filters.panelType) return;
      model.widths.forEach(function (width) {
        if (filters.maxWidth && width > filters.maxWidth) return;
        var watts = output(model, width, config.correctionFactor);
        options.push({
          type: model.type,
          height: model.height,
          width: width,
          watts: watts,
          unitWatts: watts,
          quantity: 1,
          ratedWatts: model.wattsPerMetre * (width / 1000),
          manufacturer: model.manufacturer || 'Stelrad',
          size: model.size || model.height + '(h) x ' + width + '(w) ' + model.type
        });
      });
    });
    return sortOptions(options, filters);
  }

  function suitableOptions(requiredWatts, options, quantity) {
    requiredWatts = Math.max(0, Number(requiredWatts) || 0);
    quantity = Math.max(1, Math.round(Number(quantity) || 1));
    if (!requiredWatts) return [];
    return options.map(function (option) {
      var watts = option.watts * quantity;
      return Object.assign({}, option, {
        watts: watts,
        unitWatts: option.watts,
        quantity: quantity,
        ratedWatts: option.ratedWatts * quantity,
        oversizePercent: Math.max(0, (watts - requiredWatts) / requiredWatts * 100),
        size: quantity > 1 ? quantity + ' x ' + option.size : option.size
      });
    }).filter(function (option) {
      return option.watts >= requiredWatts && option.watts <= requiredWatts * 1.5 + 0.01;
    });
  }

  function suitablePairs(requiredWatts, options) {
    requiredWatts = Math.max(0, Number(requiredWatts) || 0);
    if (!requiredWatts) return { units: [], pairs: [] };
    var maximumWatts = requiredWatts * 1.5;
    var units = options.filter(function (option) { return option.watts < maximumWatts; });
    var pairs = [];
    var participatingSizes = {};
    units.forEach(function (first, firstIndex) {
      for (var secondIndex = firstIndex; secondIndex < units.length; secondIndex += 1) {
        var second = units[secondIndex];
        var watts = first.watts + second.watts;
        if (watts < requiredWatts || watts > maximumWatts + 0.01) continue;
        participatingSizes[first.size] = true;
        participatingSizes[second.size] = true;
        pairs.push({
          first: first,
          second: second,
          watts: watts,
          size: first.size + ' + ' + second.size,
          quantity: 2,
          oversizePercent: Math.max(0, (watts - requiredWatts) / requiredWatts * 100)
        });
      }
    });
    pairs.sort(function (a, b) {
      return a.watts - b.watts || a.size.localeCompare(b.size);
    });
    return {
      units: units.filter(function (option) { return participatingSizes[option.size]; }),
      pairs: pairs
    };
  }

  function selectRadiators(requiredWatts, singleOptions, pairData, quantityChoice) {
    var useTwo = quantityChoice === '2' ||
      (quantityChoice === 'Automatic' && singleOptions.length === 0);
    if (useTwo) return pairData.pairs[0] || null;
    return singleOptions.reduce(function (closest, option) {
      return !closest || option.watts < closest.watts ? option : closest;
    }, null);
  }

  function recommendedSystemOutputKw(radiatorOutputWatts) {
    return Number(Math.max(12,
      Math.max(0, Number(radiatorOutputWatts) || 0) / 1000 * 1.1).toFixed(2));
  }

  return {
    correctionFactor: correctionFactor,
    individualOptions: individualOptions,
    output: output,
    recommendedSystemOutputKw: recommendedSystemOutputKw,
    selectRadiators: selectRadiators,
    sortOptions: sortOptions,
    suitableOptions: suitableOptions,
    suitablePairs: suitablePairs
  };
});
