
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function requiredArgs(required, args) {
      if (args.length < required) {
        throw new TypeError(required + ' argument' + (required > 1 ? 's' : '') + ' required, but only ' + args.length + ' present');
      }
    }

    /**
     * @name toDate
     * @category Common Helpers
     * @summary Convert the given argument to an instance of Date.
     *
     * @description
     * Convert the given argument to an instance of Date.
     *
     * If the argument is an instance of Date, the function returns its clone.
     *
     * If the argument is a number, it is treated as a timestamp.
     *
     * If the argument is none of the above, the function returns Invalid Date.
     *
     * **Note**: *all* Date arguments passed to any *date-fns* function is processed by `toDate`.
     *
     * @param {Date|Number} argument - the value to convert
     * @returns {Date} the parsed date in the local time zone
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // Clone the date:
     * const result = toDate(new Date(2014, 1, 11, 11, 30, 30))
     * //=> Tue Feb 11 2014 11:30:30
     *
     * @example
     * // Convert the timestamp to date:
     * const result = toDate(1392098430000)
     * //=> Tue Feb 11 2014 11:30:30
     */

    function toDate(argument) {
      requiredArgs(1, arguments);
      var argStr = Object.prototype.toString.call(argument); // Clone the date

      if (argument instanceof Date || typeof argument === 'object' && argStr === '[object Date]') {
        // Prevent the date to lose the milliseconds when passed to new Date() in IE10
        return new Date(argument.getTime());
      } else if (typeof argument === 'number' || argStr === '[object Number]') {
        return new Date(argument);
      } else {
        if ((typeof argument === 'string' || argStr === '[object String]') && typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn("Starting with v2.0.0-beta.1 date-fns doesn't accept strings as date arguments. Please use `parseISO` to parse strings. See: https://git.io/fjule"); // eslint-disable-next-line no-console

          console.warn(new Error().stack);
        }

        return new Date(NaN);
      }
    }

    var MILLISECONDS_IN_MINUTE = 60000;

    function getDateMillisecondsPart(date) {
      return date.getTime() % MILLISECONDS_IN_MINUTE;
    }
    /**
     * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
     * They usually appear for dates that denote time before the timezones were introduced
     * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
     * and GMT+01:00:00 after that date)
     *
     * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
     * which would lead to incorrect calculations.
     *
     * This function returns the timezone offset in milliseconds that takes seconds in account.
     */


    function getTimezoneOffsetInMilliseconds(dirtyDate) {
      var date = new Date(dirtyDate.getTime());
      var baseTimezoneOffset = Math.ceil(date.getTimezoneOffset());
      date.setSeconds(0, 0);
      var hasNegativeUTCOffset = baseTimezoneOffset > 0;
      var millisecondsPartOfTimezoneOffset = hasNegativeUTCOffset ? (MILLISECONDS_IN_MINUTE + getDateMillisecondsPart(date)) % MILLISECONDS_IN_MINUTE : getDateMillisecondsPart(date);
      return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset;
    }

    /**
     * @name compareAsc
     * @category Common Helpers
     * @summary Compare the two dates and return -1, 0 or 1.
     *
     * @description
     * Compare the two dates and return 1 if the first date is after the second,
     * -1 if the first date is before the second or 0 if dates are equal.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * @param {Date|Number} dateLeft - the first date to compare
     * @param {Date|Number} dateRight - the second date to compare
     * @returns {Number} the result of the comparison
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Compare 11 February 1987 and 10 July 1989:
     * var result = compareAsc(new Date(1987, 1, 11), new Date(1989, 6, 10))
     * //=> -1
     *
     * @example
     * // Sort the array of dates:
     * var result = [
     *   new Date(1995, 6, 2),
     *   new Date(1987, 1, 11),
     *   new Date(1989, 6, 10)
     * ].sort(compareAsc)
     * //=> [
     * //   Wed Feb 11 1987 00:00:00,
     * //   Mon Jul 10 1989 00:00:00,
     * //   Sun Jul 02 1995 00:00:00
     * // ]
     */

    function compareAsc(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var diff = dateLeft.getTime() - dateRight.getTime();

      if (diff < 0) {
        return -1;
      } else if (diff > 0) {
        return 1; // Return 0 if diff is 0; return NaN if diff is NaN
      } else {
        return diff;
      }
    }

    /**
     * @name differenceInCalendarMonths
     * @category Month Helpers
     * @summary Get the number of calendar months between the given dates.
     *
     * @description
     * Get the number of calendar months between the given dates.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of calendar months
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many calendar months are between 31 January 2014 and 1 September 2014?
     * var result = differenceInCalendarMonths(
     *   new Date(2014, 8, 1),
     *   new Date(2014, 0, 31)
     * )
     * //=> 8
     */

    function differenceInCalendarMonths(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var yearDiff = dateLeft.getFullYear() - dateRight.getFullYear();
      var monthDiff = dateLeft.getMonth() - dateRight.getMonth();
      return yearDiff * 12 + monthDiff;
    }

    /**
     * @name differenceInMilliseconds
     * @category Millisecond Helpers
     * @summary Get the number of milliseconds between the given dates.
     *
     * @description
     * Get the number of milliseconds between the given dates.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of milliseconds
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many milliseconds are between
     * // 2 July 2014 12:30:20.600 and 2 July 2014 12:30:21.700?
     * var result = differenceInMilliseconds(
     *   new Date(2014, 6, 2, 12, 30, 21, 700),
     *   new Date(2014, 6, 2, 12, 30, 20, 600)
     * )
     * //=> 1100
     */

    function differenceInMilliseconds(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      return dateLeft.getTime() - dateRight.getTime();
    }

    /**
     * @name differenceInMonths
     * @category Month Helpers
     * @summary Get the number of full months between the given dates.
     *
     * @description
     * Get the number of full months between the given dates.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of full months
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full months are between 31 January 2014 and 1 September 2014?
     * var result = differenceInMonths(new Date(2014, 8, 1), new Date(2014, 0, 31))
     * //=> 7
     */

    function differenceInMonths(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var sign = compareAsc(dateLeft, dateRight);
      var difference = Math.abs(differenceInCalendarMonths(dateLeft, dateRight));
      dateLeft.setMonth(dateLeft.getMonth() - sign * difference); // Math.abs(diff in full months - diff in calendar months) === 1 if last calendar month is not full
      // If so, result must be decreased by 1 in absolute value

      var isLastMonthNotFull = compareAsc(dateLeft, dateRight) === -sign;
      var result = sign * (difference - isLastMonthNotFull); // Prevent negative zero

      return result === 0 ? 0 : result;
    }

    /**
     * @name differenceInSeconds
     * @category Second Helpers
     * @summary Get the number of seconds between the given dates.
     *
     * @description
     * Get the number of seconds between the given dates.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of seconds
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many seconds are between
     * // 2 July 2014 12:30:07.999 and 2 July 2014 12:30:20.000?
     * var result = differenceInSeconds(
     *   new Date(2014, 6, 2, 12, 30, 20, 0),
     *   new Date(2014, 6, 2, 12, 30, 7, 999)
     * )
     * //=> 12
     */

    function differenceInSeconds(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var diff = differenceInMilliseconds(dirtyDateLeft, dirtyDateRight) / 1000;
      return diff > 0 ? Math.floor(diff) : Math.ceil(diff);
    }

    var formatDistanceLocale = {
      lessThanXSeconds: {
        one: 'less than a second',
        other: 'less than {{count}} seconds'
      },
      xSeconds: {
        one: '1 second',
        other: '{{count}} seconds'
      },
      halfAMinute: 'half a minute',
      lessThanXMinutes: {
        one: 'less than a minute',
        other: 'less than {{count}} minutes'
      },
      xMinutes: {
        one: '1 minute',
        other: '{{count}} minutes'
      },
      aboutXHours: {
        one: 'about 1 hour',
        other: 'about {{count}} hours'
      },
      xHours: {
        one: '1 hour',
        other: '{{count}} hours'
      },
      xDays: {
        one: '1 day',
        other: '{{count}} days'
      },
      aboutXWeeks: {
        one: 'about 1 week',
        other: 'about {{count}} weeks'
      },
      xWeeks: {
        one: '1 week',
        other: '{{count}} weeks'
      },
      aboutXMonths: {
        one: 'about 1 month',
        other: 'about {{count}} months'
      },
      xMonths: {
        one: '1 month',
        other: '{{count}} months'
      },
      aboutXYears: {
        one: 'about 1 year',
        other: 'about {{count}} years'
      },
      xYears: {
        one: '1 year',
        other: '{{count}} years'
      },
      overXYears: {
        one: 'over 1 year',
        other: 'over {{count}} years'
      },
      almostXYears: {
        one: 'almost 1 year',
        other: 'almost {{count}} years'
      }
    };
    function formatDistance(token, count, options) {
      options = options || {};
      var result;

      if (typeof formatDistanceLocale[token] === 'string') {
        result = formatDistanceLocale[token];
      } else if (count === 1) {
        result = formatDistanceLocale[token].one;
      } else {
        result = formatDistanceLocale[token].other.replace('{{count}}', count);
      }

      if (options.addSuffix) {
        if (options.comparison > 0) {
          return 'in ' + result;
        } else {
          return result + ' ago';
        }
      }

      return result;
    }

    function buildFormatLongFn(args) {
      return function (dirtyOptions) {
        var options = dirtyOptions || {};
        var width = options.width ? String(options.width) : args.defaultWidth;
        var format = args.formats[width] || args.formats[args.defaultWidth];
        return format;
      };
    }

    var dateFormats = {
      full: 'EEEE, MMMM do, y',
      long: 'MMMM do, y',
      medium: 'MMM d, y',
      short: 'MM/dd/yyyy'
    };
    var timeFormats = {
      full: 'h:mm:ss a zzzz',
      long: 'h:mm:ss a z',
      medium: 'h:mm:ss a',
      short: 'h:mm a'
    };
    var dateTimeFormats = {
      full: "{{date}} 'at' {{time}}",
      long: "{{date}} 'at' {{time}}",
      medium: '{{date}}, {{time}}',
      short: '{{date}}, {{time}}'
    };
    var formatLong = {
      date: buildFormatLongFn({
        formats: dateFormats,
        defaultWidth: 'full'
      }),
      time: buildFormatLongFn({
        formats: timeFormats,
        defaultWidth: 'full'
      }),
      dateTime: buildFormatLongFn({
        formats: dateTimeFormats,
        defaultWidth: 'full'
      })
    };

    var formatRelativeLocale = {
      lastWeek: "'last' eeee 'at' p",
      yesterday: "'yesterday at' p",
      today: "'today at' p",
      tomorrow: "'tomorrow at' p",
      nextWeek: "eeee 'at' p",
      other: 'P'
    };
    function formatRelative(token, _date, _baseDate, _options) {
      return formatRelativeLocale[token];
    }

    function buildLocalizeFn(args) {
      return function (dirtyIndex, dirtyOptions) {
        var options = dirtyOptions || {};
        var context = options.context ? String(options.context) : 'standalone';
        var valuesArray;

        if (context === 'formatting' && args.formattingValues) {
          var defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
          var width = options.width ? String(options.width) : defaultWidth;
          valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
        } else {
          var _defaultWidth = args.defaultWidth;

          var _width = options.width ? String(options.width) : args.defaultWidth;

          valuesArray = args.values[_width] || args.values[_defaultWidth];
        }

        var index = args.argumentCallback ? args.argumentCallback(dirtyIndex) : dirtyIndex;
        return valuesArray[index];
      };
    }

    var eraValues = {
      narrow: ['B', 'A'],
      abbreviated: ['BC', 'AD'],
      wide: ['Before Christ', 'Anno Domini']
    };
    var quarterValues = {
      narrow: ['1', '2', '3', '4'],
      abbreviated: ['Q1', 'Q2', 'Q3', 'Q4'],
      wide: ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'] // Note: in English, the names of days of the week and months are capitalized.
      // If you are making a new locale based on this one, check if the same is true for the language you're working on.
      // Generally, formatted dates should look like they are in the middle of a sentence,
      // e.g. in Spanish language the weekdays and months should be in the lowercase.

    };
    var monthValues = {
      narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      abbreviated: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      wide: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    var dayValues = {
      narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      wide: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    };
    var dayPeriodValues = {
      narrow: {
        am: 'a',
        pm: 'p',
        midnight: 'mi',
        noon: 'n',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      },
      abbreviated: {
        am: 'AM',
        pm: 'PM',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      },
      wide: {
        am: 'a.m.',
        pm: 'p.m.',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      }
    };
    var formattingDayPeriodValues = {
      narrow: {
        am: 'a',
        pm: 'p',
        midnight: 'mi',
        noon: 'n',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      },
      abbreviated: {
        am: 'AM',
        pm: 'PM',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      },
      wide: {
        am: 'a.m.',
        pm: 'p.m.',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      }
    };

    function ordinalNumber(dirtyNumber, _dirtyOptions) {
      var number = Number(dirtyNumber); // If ordinal numbers depend on context, for example,
      // if they are different for different grammatical genders,
      // use `options.unit`:
      //
      //   var options = dirtyOptions || {}
      //   var unit = String(options.unit)
      //
      // where `unit` can be 'year', 'quarter', 'month', 'week', 'date', 'dayOfYear',
      // 'day', 'hour', 'minute', 'second'

      var rem100 = number % 100;

      if (rem100 > 20 || rem100 < 10) {
        switch (rem100 % 10) {
          case 1:
            return number + 'st';

          case 2:
            return number + 'nd';

          case 3:
            return number + 'rd';
        }
      }

      return number + 'th';
    }

    var localize = {
      ordinalNumber: ordinalNumber,
      era: buildLocalizeFn({
        values: eraValues,
        defaultWidth: 'wide'
      }),
      quarter: buildLocalizeFn({
        values: quarterValues,
        defaultWidth: 'wide',
        argumentCallback: function (quarter) {
          return Number(quarter) - 1;
        }
      }),
      month: buildLocalizeFn({
        values: monthValues,
        defaultWidth: 'wide'
      }),
      day: buildLocalizeFn({
        values: dayValues,
        defaultWidth: 'wide'
      }),
      dayPeriod: buildLocalizeFn({
        values: dayPeriodValues,
        defaultWidth: 'wide',
        formattingValues: formattingDayPeriodValues,
        defaultFormattingWidth: 'wide'
      })
    };

    function buildMatchPatternFn(args) {
      return function (dirtyString, dirtyOptions) {
        var string = String(dirtyString);
        var options = dirtyOptions || {};
        var matchResult = string.match(args.matchPattern);

        if (!matchResult) {
          return null;
        }

        var matchedString = matchResult[0];
        var parseResult = string.match(args.parsePattern);

        if (!parseResult) {
          return null;
        }

        var value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
        value = options.valueCallback ? options.valueCallback(value) : value;
        return {
          value: value,
          rest: string.slice(matchedString.length)
        };
      };
    }

    function buildMatchFn(args) {
      return function (dirtyString, dirtyOptions) {
        var string = String(dirtyString);
        var options = dirtyOptions || {};
        var width = options.width;
        var matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
        var matchResult = string.match(matchPattern);

        if (!matchResult) {
          return null;
        }

        var matchedString = matchResult[0];
        var parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
        var value;

        if (Object.prototype.toString.call(parsePatterns) === '[object Array]') {
          value = findIndex(parsePatterns, function (pattern) {
            return pattern.test(matchedString);
          });
        } else {
          value = findKey(parsePatterns, function (pattern) {
            return pattern.test(matchedString);
          });
        }

        value = args.valueCallback ? args.valueCallback(value) : value;
        value = options.valueCallback ? options.valueCallback(value) : value;
        return {
          value: value,
          rest: string.slice(matchedString.length)
        };
      };
    }

    function findKey(object, predicate) {
      for (var key in object) {
        if (object.hasOwnProperty(key) && predicate(object[key])) {
          return key;
        }
      }
    }

    function findIndex(array, predicate) {
      for (var key = 0; key < array.length; key++) {
        if (predicate(array[key])) {
          return key;
        }
      }
    }

    var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
    var parseOrdinalNumberPattern = /\d+/i;
    var matchEraPatterns = {
      narrow: /^(b|a)/i,
      abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
      wide: /^(before christ|before common era|anno domini|common era)/i
    };
    var parseEraPatterns = {
      any: [/^b/i, /^(a|c)/i]
    };
    var matchQuarterPatterns = {
      narrow: /^[1234]/i,
      abbreviated: /^q[1234]/i,
      wide: /^[1234](th|st|nd|rd)? quarter/i
    };
    var parseQuarterPatterns = {
      any: [/1/i, /2/i, /3/i, /4/i]
    };
    var matchMonthPatterns = {
      narrow: /^[jfmasond]/i,
      abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
    };
    var parseMonthPatterns = {
      narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
      any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
    };
    var matchDayPatterns = {
      narrow: /^[smtwf]/i,
      short: /^(su|mo|tu|we|th|fr|sa)/i,
      abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
      wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
    };
    var parseDayPatterns = {
      narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
      any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
    };
    var matchDayPeriodPatterns = {
      narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
      any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
    };
    var parseDayPeriodPatterns = {
      any: {
        am: /^a/i,
        pm: /^p/i,
        midnight: /^mi/i,
        noon: /^no/i,
        morning: /morning/i,
        afternoon: /afternoon/i,
        evening: /evening/i,
        night: /night/i
      }
    };
    var match = {
      ordinalNumber: buildMatchPatternFn({
        matchPattern: matchOrdinalNumberPattern,
        parsePattern: parseOrdinalNumberPattern,
        valueCallback: function (value) {
          return parseInt(value, 10);
        }
      }),
      era: buildMatchFn({
        matchPatterns: matchEraPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseEraPatterns,
        defaultParseWidth: 'any'
      }),
      quarter: buildMatchFn({
        matchPatterns: matchQuarterPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseQuarterPatterns,
        defaultParseWidth: 'any',
        valueCallback: function (index) {
          return index + 1;
        }
      }),
      month: buildMatchFn({
        matchPatterns: matchMonthPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseMonthPatterns,
        defaultParseWidth: 'any'
      }),
      day: buildMatchFn({
        matchPatterns: matchDayPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseDayPatterns,
        defaultParseWidth: 'any'
      }),
      dayPeriod: buildMatchFn({
        matchPatterns: matchDayPeriodPatterns,
        defaultMatchWidth: 'any',
        parsePatterns: parseDayPeriodPatterns,
        defaultParseWidth: 'any'
      })
    };

    /**
     * @type {Locale}
     * @category Locales
     * @summary English locale (United States).
     * @language English
     * @iso-639-2 eng
     * @author Sasha Koss [@kossnocorp]{@link https://github.com/kossnocorp}
     * @author Lesha Koss [@leshakoss]{@link https://github.com/leshakoss}
     */

    var locale = {
      code: 'en-US',
      formatDistance: formatDistance,
      formatLong: formatLong,
      formatRelative: formatRelative,
      localize: localize,
      match: match,
      options: {
        weekStartsOn: 0
        /* Sunday */
        ,
        firstWeekContainsDate: 1
      }
    };

    function assign(target, dirtyObject) {
      if (target == null) {
        throw new TypeError('assign requires that input parameter not be null or undefined');
      }

      dirtyObject = dirtyObject || {};

      for (var property in dirtyObject) {
        if (dirtyObject.hasOwnProperty(property)) {
          target[property] = dirtyObject[property];
        }
      }

      return target;
    }

    function cloneObject(dirtyObject) {
      return assign({}, dirtyObject);
    }

    var MINUTES_IN_DAY = 1440;
    var MINUTES_IN_ALMOST_TWO_DAYS = 2520;
    var MINUTES_IN_MONTH = 43200;
    var MINUTES_IN_TWO_MONTHS = 86400;
    /**
     * @name formatDistance
     * @category Common Helpers
     * @summary Return the distance between the given dates in words.
     *
     * @description
     * Return the distance between the given dates in words.
     *
     * | Distance between dates                                            | Result              |
     * |-------------------------------------------------------------------|---------------------|
     * | 0 ... 30 secs                                                     | less than a minute  |
     * | 30 secs ... 1 min 30 secs                                         | 1 minute            |
     * | 1 min 30 secs ... 44 mins 30 secs                                 | [2..44] minutes     |
     * | 44 mins ... 30 secs ... 89 mins 30 secs                           | about 1 hour        |
     * | 89 mins 30 secs ... 23 hrs 59 mins 30 secs                        | about [2..24] hours |
     * | 23 hrs 59 mins 30 secs ... 41 hrs 59 mins 30 secs                 | 1 day               |
     * | 41 hrs 59 mins 30 secs ... 29 days 23 hrs 59 mins 30 secs         | [2..30] days        |
     * | 29 days 23 hrs 59 mins 30 secs ... 44 days 23 hrs 59 mins 30 secs | about 1 month       |
     * | 44 days 23 hrs 59 mins 30 secs ... 59 days 23 hrs 59 mins 30 secs | about 2 months      |
     * | 59 days 23 hrs 59 mins 30 secs ... 1 yr                           | [2..12] months      |
     * | 1 yr ... 1 yr 3 months                                            | about 1 year        |
     * | 1 yr 3 months ... 1 yr 9 month s                                  | over 1 year         |
     * | 1 yr 9 months ... 2 yrs                                           | almost 2 years      |
     * | N yrs ... N yrs 3 months                                          | about N years       |
     * | N yrs 3 months ... N yrs 9 months                                 | over N years        |
     * | N yrs 9 months ... N+1 yrs                                        | almost N+1 years    |
     *
     * With `options.includeSeconds == true`:
     * | Distance between dates | Result               |
     * |------------------------|----------------------|
     * | 0 secs ... 5 secs      | less than 5 seconds  |
     * | 5 secs ... 10 secs     | less than 10 seconds |
     * | 10 secs ... 20 secs    | less than 20 seconds |
     * | 20 secs ... 40 secs    | half a minute        |
     * | 40 secs ... 60 secs    | less than a minute   |
     * | 60 secs ... 90 secs    | 1 minute             |
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * - The function was renamed from `distanceInWords ` to `formatDistance`
     *   to make its name consistent with `format` and `formatRelative`.
     *
     * - The order of arguments is swapped to make the function
     *   consistent with `differenceIn...` functions.
     *
     *   ```javascript
     *   // Before v2.0.0
     *
     *   distanceInWords(
     *     new Date(1986, 3, 4, 10, 32, 0),
     *     new Date(1986, 3, 4, 11, 32, 0),
     *     { addSuffix: true }
     *   ) //=> 'in about 1 hour'
     *
     *   // v2.0.0 onward
     *
     *   formatDistance(
     *     new Date(1986, 3, 4, 11, 32, 0),
     *     new Date(1986, 3, 4, 10, 32, 0),
     *     { addSuffix: true }
     *   ) //=> 'in about 1 hour'
     *   ```
     *
     * @param {Date|Number} date - the date
     * @param {Date|Number} baseDate - the date to compare with
     * @param {Object} [options] - an object with options.
     * @param {Boolean} [options.includeSeconds=false] - distances less than a minute are more detailed
     * @param {Boolean} [options.addSuffix=false] - result indicates if the second date is earlier or later than the first
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @returns {String} the distance in words
     * @throws {TypeError} 2 arguments required
     * @throws {RangeError} `date` must not be Invalid Date
     * @throws {RangeError} `baseDate` must not be Invalid Date
     * @throws {RangeError} `options.locale` must contain `formatDistance` property
     *
     * @example
     * // What is the distance between 2 July 2014 and 1 January 2015?
     * var result = formatDistance(new Date(2014, 6, 2), new Date(2015, 0, 1))
     * //=> '6 months'
     *
     * @example
     * // What is the distance between 1 January 2015 00:00:15
     * // and 1 January 2015 00:00:00, including seconds?
     * var result = formatDistance(
     *   new Date(2015, 0, 1, 0, 0, 15),
     *   new Date(2015, 0, 1, 0, 0, 0),
     *   { includeSeconds: true }
     * )
     * //=> 'less than 20 seconds'
     *
     * @example
     * // What is the distance from 1 January 2016
     * // to 1 January 2015, with a suffix?
     * var result = formatDistance(new Date(2015, 0, 1), new Date(2016, 0, 1), {
     *   addSuffix: true
     * })
     * //=> 'about 1 year ago'
     *
     * @example
     * // What is the distance between 1 August 2016 and 1 January 2015 in Esperanto?
     * import { eoLocale } from 'date-fns/locale/eo'
     * var result = formatDistance(new Date(2016, 7, 1), new Date(2015, 0, 1), {
     *   locale: eoLocale
     * })
     * //=> 'pli ol 1 jaro'
     */

    function formatDistance$1(dirtyDate, dirtyBaseDate, dirtyOptions) {
      requiredArgs(2, arguments);
      var options = dirtyOptions || {};
      var locale$1 = options.locale || locale;

      if (!locale$1.formatDistance) {
        throw new RangeError('locale must contain formatDistance property');
      }

      var comparison = compareAsc(dirtyDate, dirtyBaseDate);

      if (isNaN(comparison)) {
        throw new RangeError('Invalid time value');
      }

      var localizeOptions = cloneObject(options);
      localizeOptions.addSuffix = Boolean(options.addSuffix);
      localizeOptions.comparison = comparison;
      var dateLeft;
      var dateRight;

      if (comparison > 0) {
        dateLeft = toDate(dirtyBaseDate);
        dateRight = toDate(dirtyDate);
      } else {
        dateLeft = toDate(dirtyDate);
        dateRight = toDate(dirtyBaseDate);
      }

      var seconds = differenceInSeconds(dateRight, dateLeft);
      var offsetInSeconds = (getTimezoneOffsetInMilliseconds(dateRight) - getTimezoneOffsetInMilliseconds(dateLeft)) / 1000;
      var minutes = Math.round((seconds - offsetInSeconds) / 60);
      var months; // 0 up to 2 mins

      if (minutes < 2) {
        if (options.includeSeconds) {
          if (seconds < 5) {
            return locale$1.formatDistance('lessThanXSeconds', 5, localizeOptions);
          } else if (seconds < 10) {
            return locale$1.formatDistance('lessThanXSeconds', 10, localizeOptions);
          } else if (seconds < 20) {
            return locale$1.formatDistance('lessThanXSeconds', 20, localizeOptions);
          } else if (seconds < 40) {
            return locale$1.formatDistance('halfAMinute', null, localizeOptions);
          } else if (seconds < 60) {
            return locale$1.formatDistance('lessThanXMinutes', 1, localizeOptions);
          } else {
            return locale$1.formatDistance('xMinutes', 1, localizeOptions);
          }
        } else {
          if (minutes === 0) {
            return locale$1.formatDistance('lessThanXMinutes', 1, localizeOptions);
          } else {
            return locale$1.formatDistance('xMinutes', minutes, localizeOptions);
          }
        } // 2 mins up to 0.75 hrs

      } else if (minutes < 45) {
        return locale$1.formatDistance('xMinutes', minutes, localizeOptions); // 0.75 hrs up to 1.5 hrs
      } else if (minutes < 90) {
        return locale$1.formatDistance('aboutXHours', 1, localizeOptions); // 1.5 hrs up to 24 hrs
      } else if (minutes < MINUTES_IN_DAY) {
        var hours = Math.round(minutes / 60);
        return locale$1.formatDistance('aboutXHours', hours, localizeOptions); // 1 day up to 1.75 days
      } else if (minutes < MINUTES_IN_ALMOST_TWO_DAYS) {
        return locale$1.formatDistance('xDays', 1, localizeOptions); // 1.75 days up to 30 days
      } else if (minutes < MINUTES_IN_MONTH) {
        var days = Math.round(minutes / MINUTES_IN_DAY);
        return locale$1.formatDistance('xDays', days, localizeOptions); // 1 month up to 2 months
      } else if (minutes < MINUTES_IN_TWO_MONTHS) {
        months = Math.round(minutes / MINUTES_IN_MONTH);
        return locale$1.formatDistance('aboutXMonths', months, localizeOptions);
      }

      months = differenceInMonths(dateRight, dateLeft); // 2 months up to 12 months

      if (months < 12) {
        var nearestMonth = Math.round(minutes / MINUTES_IN_MONTH);
        return locale$1.formatDistance('xMonths', nearestMonth, localizeOptions); // 1 year up to max Date
      } else {
        var monthsSinceStartOfYear = months % 12;
        var years = Math.floor(months / 12); // N years up to 1 years 3 months

        if (monthsSinceStartOfYear < 3) {
          return locale$1.formatDistance('aboutXYears', years, localizeOptions); // N years 3 months up to N years 9 months
        } else if (monthsSinceStartOfYear < 9) {
          return locale$1.formatDistance('overXYears', years, localizeOptions); // N years 9 months up to N year 12 months
        } else {
          return locale$1.formatDistance('almostXYears', years + 1, localizeOptions);
        }
      }
    }

    /**
     * @name formatDistanceToNow
     * @category Common Helpers
     * @summary Return the distance between the given date and now in words.
     * @pure false
     *
     * @description
     * Return the distance between the given date and now in words.
     *
     * | Distance to now                                                   | Result              |
     * |-------------------------------------------------------------------|---------------------|
     * | 0 ... 30 secs                                                     | less than a minute  |
     * | 30 secs ... 1 min 30 secs                                         | 1 minute            |
     * | 1 min 30 secs ... 44 mins 30 secs                                 | [2..44] minutes     |
     * | 44 mins ... 30 secs ... 89 mins 30 secs                           | about 1 hour        |
     * | 89 mins 30 secs ... 23 hrs 59 mins 30 secs                        | about [2..24] hours |
     * | 23 hrs 59 mins 30 secs ... 41 hrs 59 mins 30 secs                 | 1 day               |
     * | 41 hrs 59 mins 30 secs ... 29 days 23 hrs 59 mins 30 secs         | [2..30] days        |
     * | 29 days 23 hrs 59 mins 30 secs ... 44 days 23 hrs 59 mins 30 secs | about 1 month       |
     * | 44 days 23 hrs 59 mins 30 secs ... 59 days 23 hrs 59 mins 30 secs | about 2 months      |
     * | 59 days 23 hrs 59 mins 30 secs ... 1 yr                           | [2..12] months      |
     * | 1 yr ... 1 yr 3 months                                            | about 1 year        |
     * | 1 yr 3 months ... 1 yr 9 month s                                  | over 1 year         |
     * | 1 yr 9 months ... 2 yrs                                           | almost 2 years      |
     * | N yrs ... N yrs 3 months                                          | about N years       |
     * | N yrs 3 months ... N yrs 9 months                                 | over N years        |
     * | N yrs 9 months ... N+1 yrs                                        | almost N+1 years    |
     *
     * With `options.includeSeconds == true`:
     * | Distance to now     | Result               |
     * |---------------------|----------------------|
     * | 0 secs ... 5 secs   | less than 5 seconds  |
     * | 5 secs ... 10 secs  | less than 10 seconds |
     * | 10 secs ... 20 secs | less than 20 seconds |
     * | 20 secs ... 40 secs | half a minute        |
     * | 40 secs ... 60 secs | less than a minute   |
     * | 60 secs ... 90 secs | 1 minute             |
     *
     * > ⚠️ Please note that this function is not present in the FP submodule as
     * > it uses `Date.now()` internally hence impure and can't be safely curried.
     *
     * ### v2.0.0 breaking changes:
     *
     * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
     *
     * - The function was renamed from `distanceInWordsToNow ` to `formatDistanceToNow`
     *   to make its name consistent with `format` and `formatRelative`.
     *
     *   ```javascript
     *   // Before v2.0.0
     *
     *   distanceInWordsToNow(new Date(2014, 6, 2), { addSuffix: true })
     *   //=> 'in 6 months'
     *
     *   // v2.0.0 onward
     *
     *   formatDistanceToNow(new Date(2014, 6, 2), { addSuffix: true })
     *   //=> 'in 6 months'
     *   ```
     *
     * @param {Date|Number} date - the given date
     * @param {Object} [options] - the object with options
     * @param {Boolean} [options.includeSeconds=false] - distances less than a minute are more detailed
     * @param {Boolean} [options.addSuffix=false] - result specifies if now is earlier or later than the passed date
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @returns {String} the distance in words
     * @throws {TypeError} 1 argument required
     * @throws {RangeError} `date` must not be Invalid Date
     * @throws {RangeError} `options.locale` must contain `formatDistance` property
     *
     * @example
     * // If today is 1 January 2015, what is the distance to 2 July 2014?
     * var result = formatDistanceToNow(
     *   new Date(2014, 6, 2)
     * )
     * //=> '6 months'
     *
     * @example
     * // If now is 1 January 2015 00:00:00,
     * // what is the distance to 1 January 2015 00:00:15, including seconds?
     * var result = formatDistanceToNow(
     *   new Date(2015, 0, 1, 0, 0, 15),
     *   {includeSeconds: true}
     * )
     * //=> 'less than 20 seconds'
     *
     * @example
     * // If today is 1 January 2015,
     * // what is the distance to 1 January 2016, with a suffix?
     * var result = formatDistanceToNow(
     *   new Date(2016, 0, 1),
     *   {addSuffix: true}
     * )
     * //=> 'in about 1 year'
     *
     * @example
     * // If today is 1 January 2015,
     * // what is the distance to 1 August 2016 in Esperanto?
     * var eoLocale = require('date-fns/locale/eo')
     * var result = formatDistanceToNow(
     *   new Date(2016, 7, 1),
     *   {locale: eoLocale}
     * )
     * //=> 'pli ol 1 jaro'
     */

    function formatDistanceToNow(dirtyDate, dirtyOptions) {
      requiredArgs(1, arguments);
      return formatDistance$1(dirtyDate, Date.now(), dirtyOptions);
    }

    var formatDistanceLocale$1 = {
      lessThanXSeconds: {
        one: 'bir saniyeden az',
        other: '{{count}} saniyeden az'
      },
      xSeconds: {
        one: '1 saniye',
        other: '{{count}} saniye'
      },
      halfAMinute: 'yarım dakika',
      lessThanXMinutes: {
        one: 'bir dakikadan az',
        other: '{{count}} dakikadan az'
      },
      xMinutes: {
        one: '1 dakika',
        other: '{{count}} dakika'
      },
      aboutXHours: {
        one: 'yaklaşık 1 saat',
        other: 'yaklaşık {{count}} saat'
      },
      xHours: {
        one: '1 saat',
        other: '{{count}} saat'
      },
      xDays: {
        one: '1 gün',
        other: '{{count}} gün'
      },
      aboutXWeeks: {
        one: 'yaklaşık 1 hafta',
        other: 'yaklaşık {{count}} hafta'
      },
      xWeeks: {
        one: '1 hafta',
        other: '{{count}} hafta'
      },
      aboutXMonths: {
        one: 'yaklaşık 1 ay',
        other: 'yaklaşık {{count}} ay'
      },
      xMonths: {
        one: '1 ay',
        other: '{{count}} ay'
      },
      aboutXYears: {
        one: 'yaklaşık 1 yıl',
        other: 'yaklaşık {{count}} yıl'
      },
      xYears: {
        one: '1 yıl',
        other: '{{count}} yıl'
      },
      overXYears: {
        one: '1 yıldan fazla',
        other: '{{count}} yıldan fazla'
      },
      almostXYears: {
        one: 'neredeyse 1 yıl',
        other: 'neredeyse {{count}} yıl'
      }
    };
    function formatDistance$2(token, count, options) {
      options = options || {};
      var result;

      if (typeof formatDistanceLocale$1[token] === 'string') {
        result = formatDistanceLocale$1[token];
      } else if (count === 1) {
        result = formatDistanceLocale$1[token].one;
      } else {
        result = formatDistanceLocale$1[token].other.replace('{{count}}', count);
      }

      if (options.addSuffix) {
        if (options.comparison > 0) {
          return result + ' sonra';
        } else {
          return result + ' önce';
        }
      }

      return result;
    }

    var dateFormats$1 = {
      full: 'd MMMM y EEEE',
      long: 'd MMMM y',
      medium: 'd MMM y',
      short: 'dd.MM.yyyy'
    };
    var timeFormats$1 = {
      full: 'HH:mm:ss zzzz',
      long: 'HH:mm:ss z',
      medium: 'HH:mm:ss',
      short: 'HH:mm'
    };
    var dateTimeFormats$1 = {
      full: "{{date}} 'saat' {{time}}",
      long: "{{date}} 'saat' {{time}}",
      medium: '{{date}}, {{time}}',
      short: '{{date}}, {{time}}'
    };
    var formatLong$1 = {
      date: buildFormatLongFn({
        formats: dateFormats$1,
        defaultWidth: 'full'
      }),
      time: buildFormatLongFn({
        formats: timeFormats$1,
        defaultWidth: 'full'
      }),
      dateTime: buildFormatLongFn({
        formats: dateTimeFormats$1,
        defaultWidth: 'full'
      })
    };

    var formatRelativeLocale$1 = {
      lastWeek: "'geçen hafta' eeee 'saat' p",
      yesterday: "'dün saat' p",
      today: "'bugün saat' p",
      tomorrow: "'yarın saat' p",
      nextWeek: "eeee 'saat' p",
      other: 'P'
    };
    function formatRelative$1(token, _date, _baseDate, _options) {
      return formatRelativeLocale$1[token];
    }

    var eraValues$1 = {
      abbreviated: ['MÖ', 'MS'],
      narrow: ['MÖ', 'MS'],
      wide: ['Milattan Önce', 'Milattan Sonra']
    };
    var quarterValues$1 = {
      narrow: ['1', '2', '3', '4'],
      abbreviated: ['1Ç', '2Ç', '3Ç', '4Ç'],
      wide: ['İlk çeyrek', 'İkinci Çeyrek', 'Üçüncü çeyrek', 'Son çeyrek']
    };
    var monthValues$1 = {
      narrow: ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'],
      abbreviated: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
      wide: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    };
    var dayValues$1 = {
      narrow: ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'],
      short: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
      abbreviated: ['Paz', 'Pts', 'Sal', 'Çar', 'Per', 'Cum', 'Cts'],
      wide: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    };
    var dayPeriodValues$1 = {
      narrow: {
        am: 'öö',
        pm: 'ös',
        midnight: 'gy',
        noon: 'ö',
        morning: 'sa',
        afternoon: 'ös',
        evening: 'ak',
        night: 'ge'
      },
      abbreviated: {
        am: 'ÖÖ',
        pm: 'ÖS',
        midnight: 'gece yarısı',
        noon: 'öğle',
        morning: 'sabah',
        afternoon: 'öğleden sonra',
        evening: 'akşam',
        night: 'gece'
      },
      wide: {
        am: 'Ö.Ö.',
        pm: 'Ö.S.',
        midnight: 'gece yarısı',
        noon: 'öğle',
        morning: 'sabah',
        afternoon: 'öğleden sonra',
        evening: 'akşam',
        night: 'gece'
      }
    };
    var formattingDayPeriodValues$1 = {
      narrow: {
        am: 'öö',
        pm: 'ös',
        midnight: 'gy',
        noon: 'ö',
        morning: 'sa',
        afternoon: 'ös',
        evening: 'ak',
        night: 'ge'
      },
      abbreviated: {
        am: 'ÖÖ',
        pm: 'ÖS',
        midnight: 'gece yarısı',
        noon: 'öğlen',
        morning: 'sabahleyin',
        afternoon: 'öğleden sonra',
        evening: 'akşamleyin',
        night: 'geceleyin'
      },
      wide: {
        am: 'ö.ö.',
        pm: 'ö.s.',
        midnight: 'gece yarısı',
        noon: 'öğlen',
        morning: 'sabahleyin',
        afternoon: 'öğleden sonra',
        evening: 'akşamleyin',
        night: 'geceleyin'
      }
    };

    function ordinalNumber$1(dirtyNumber, _dirtyOptions) {
      var number = Number(dirtyNumber);
      return number + '.';
    }

    var localize$1 = {
      ordinalNumber: ordinalNumber$1,
      era: buildLocalizeFn({
        values: eraValues$1,
        defaultWidth: 'wide'
      }),
      quarter: buildLocalizeFn({
        values: quarterValues$1,
        defaultWidth: 'wide',
        argumentCallback: function (quarter) {
          return Number(quarter) - 1;
        }
      }),
      month: buildLocalizeFn({
        values: monthValues$1,
        defaultWidth: 'wide'
      }),
      day: buildLocalizeFn({
        values: dayValues$1,
        defaultWidth: 'wide'
      }),
      dayPeriod: buildLocalizeFn({
        values: dayPeriodValues$1,
        defaultWidth: 'wide',
        formattingValues: formattingDayPeriodValues$1,
        defaulFormattingWidth: 'wide'
      })
    };

    var matchOrdinalNumberPattern$1 = /^(\d+)(\.)?/i;
    var parseOrdinalNumberPattern$1 = /\d+/i;
    var matchEraPatterns$1 = {
      narrow: /^(mö|ms)/i,
      abbreviated: /^(mö|ms)/i,
      wide: /^(milattan önce|milattan sonra)/i
    };
    var parseEraPatterns$1 = {
      any: [/(^mö|^milattan önce)/i, /(^ms|^milattan sonra)/i]
    };
    var matchQuarterPatterns$1 = {
      narrow: /^[1234]/i,
      abbreviated: /^[1234]ç/i,
      wide: /^((i|İ)lk|(i|İ)kinci|üçüncü|son) çeyrek/i
    };
    var parseQuarterPatterns$1 = {
      any: [/1/i, /2/i, /3/i, /4/i],
      abbreviated: [/1ç/i, /2ç/i, /3ç/i, /4ç/i],
      wide: [/^(i|İ)lk çeyrek/i, /(i|İ)kinci çeyrek/i, /üçüncü çeyrek/i, /son çeyrek/i]
    };
    var matchMonthPatterns$1 = {
      narrow: /^[oşmnhtaek]/i,
      abbreviated: /^(oca|şub|mar|nis|may|haz|tem|ağu|eyl|eki|kas|ara)/i,
      wide: /^(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i
    };
    var parseMonthPatterns$1 = {
      narrow: [/^o/i, /^ş/i, /^m/i, /^n/i, /^m/i, /^h/i, /^t/i, /^a/i, /^e/i, /^e/i, /^k/i, /^a/i],
      any: [/^o/i, /^ş/i, /^mar/i, /^n/i, /^may/i, /^h/i, /^t/i, /^ağ/i, /^ey/i, /^ek/i, /^k/i, /^ar/i]
    };
    var matchDayPatterns$1 = {
      narrow: /^[psçc]/i,
      short: /^(pz|pt|sa|ça|pe|cu|ct)/i,
      abbreviated: /^(paz|pts|sal|çar|per|cum|cts)/i,
      wide: /^(pazar|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi)/i
    };
    var parseDayPatterns$1 = {
      narrow: [/^p/i, /^p/i, /^s/i, /^ç/i, /^p/i, /^c/i, /^c/i],
      any: [/^pz/i, /^pt/i, /^sa/i, /^ça/i, /^pe/i, /^cu/i, /^ct/i],
      wide: [/^pazar/i, /^pazartesi/i, /^salı/i, /^çarşamba/i, /^perşembe/i, /^cuma/i, /cumartesi/i]
    };
    var matchDayPeriodPatterns$1 = {
      narrow: /^(öö|ös|gy|ö|sa|ös|ak|ge)/i,
      any: /^(ö\.?\s?[ös]\.?|öğleden sonra|gece yarısı|öğle|(sabah|öğ|akşam|gece)(leyin))/i
    };
    var parseDayPeriodPatterns$1 = {
      any: {
        am: /^ö\.?ö\.?/i,
        pm: /^ö\.?s\.?/i,
        midnight: /^(gy|gece yarısı)/i,
        noon: /^öğ/i,
        morning: /^sa/i,
        afternoon: /^öğleden sonra/i,
        evening: /^ak/i,
        night: /^ge/i
      }
    };
    var match$1 = {
      ordinalNumber: buildMatchPatternFn({
        matchPattern: matchOrdinalNumberPattern$1,
        parsePattern: parseOrdinalNumberPattern$1,
        valueCallback: function (value) {
          return parseInt(value, 10);
        }
      }),
      era: buildMatchFn({
        matchPatterns: matchEraPatterns$1,
        defaultMatchWidth: 'wide',
        parsePatterns: parseEraPatterns$1,
        defaultParseWidth: 'any'
      }),
      quarter: buildMatchFn({
        matchPatterns: matchQuarterPatterns$1,
        defaultMatchWidth: 'wide',
        parsePatterns: parseQuarterPatterns$1,
        defaultParseWidth: 'any',
        valueCallback: function (index) {
          return index + 1;
        }
      }),
      month: buildMatchFn({
        matchPatterns: matchMonthPatterns$1,
        defaultMatchWidth: 'wide',
        parsePatterns: parseMonthPatterns$1,
        defaultParseWidth: 'any'
      }),
      day: buildMatchFn({
        matchPatterns: matchDayPatterns$1,
        defaultMatchWidth: 'wide',
        parsePatterns: parseDayPatterns$1,
        defaultParseWidth: 'any'
      }),
      dayPeriod: buildMatchFn({
        matchPatterns: matchDayPeriodPatterns$1,
        defaultMatchWidth: 'any',
        parsePatterns: parseDayPeriodPatterns$1,
        defaultParseWidth: 'any'
      })
    };

    /**
     * @type {Locale}
     * @category Locales
     * @summary Turkish locale.
     * @language Turkish
     * @iso-639-2 tur
     * @author Alpcan Aydın [@alpcanaydin]{@link https://github.com/alpcanaydin}
     * @author Berkay Sargın [@berkaey]{@link https://github.com/berkaey}
     * @author Ismail Demirbilek [@dbtek]{@link https://github.com/dbtek}
     * @author İsmail Kayar [@ikayar]{@link https://github.com/ikayar}
     *
     *
     */

    var locale$1 = {
      code: 'tr',
      formatDistance: formatDistance$2,
      formatLong: formatLong$1,
      formatRelative: formatRelative$1,
      localize: localize$1,
      match: match$1,
      options: {
        weekStartsOn: 1
        /* Monday */
        ,
        firstWeekContainsDate: 1
      }
    };

    /* src/App.svelte generated by Svelte v3.31.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[36] = list[i][0];
    	child_ctx[37] = list[i][1];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[32] = list[i][0];
    	child_ctx[33] = list[i][1];
    	return child_ctx;
    }

    // (339:1) {:else}
    function create_else_block_1(ctx) {
    	let t;
    	let if_block1_anchor;
    	let if_block0 = /*phoneSent*/ ctx[7] && !/*verificationNeeded*/ ctx[8] && create_if_block_3(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*verificationNeeded*/ ctx[8]) return create_if_block_2;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*phoneSent*/ ctx[7] && !/*verificationNeeded*/ ctx[8]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(339:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (309:1) {#if uid}
    function create_if_block(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*focusedGroupId*/ ctx[3]) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(309:1) {#if uid}",
    		ctx
    	});

    	return block;
    }

    // (340:2) {#if phoneSent && !verificationNeeded}
    function create_if_block_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Loading...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(340:2) {#if phoneSent && !verificationNeeded}",
    		ctx
    	});

    	return block;
    }

    // (347:2) {:else}
    function create_else_block_2(ctx) {
    	let input;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Sign In";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "xxx xxx xx xx");
    			add_location(input, file, 347, 3, 9471);
    			attr_dev(button, "id", "signIn");
    			attr_dev(button, "class", "svelte-yid84r");
    			add_location(button, file, 348, 3, 9548);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*phoneInput*/ ctx[5]);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_2*/ ctx[22]),
    					listen_dev(button, "click", /*SignIn*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*phoneInput*/ 32 && input.value !== /*phoneInput*/ ctx[5]) {
    				set_input_value(input, /*phoneInput*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(347:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (344:2) {#if verificationNeeded}
    function create_if_block_2(ctx) {
    	let input;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Verify";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "xxx xxx");
    			add_location(input, file, 344, 3, 9327);
    			attr_dev(button, "id", "verifySms");
    			attr_dev(button, "class", "svelte-yid84r");
    			add_location(button, file, 345, 3, 9397);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*codeInput*/ ctx[6]);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[21]),
    					listen_dev(button, "click", /*ConfirmSMS*/ ctx[10], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*codeInput*/ 64 && input.value !== /*codeInput*/ ctx[6]) {
    				set_input_value(input, /*codeInput*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(344:2) {#if verificationNeeded}",
    		ctx
    	});

    	return block;
    }

    // (325:2) {:else}
    function create_else_block(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let hr;
    	let t4;
    	let div;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*groups*/ ctx[2]);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "Konuşma Başlat";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Çıkış Yap";
    			t3 = space();
    			hr = element("hr");
    			t4 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button0, "class", "svelte-yid84r");
    			add_location(button0, file, 325, 3, 8884);
    			attr_dev(button1, "class", "svelte-yid84r");
    			add_location(button1, file, 326, 3, 8950);
    			add_location(hr, file, 328, 3, 9015);
    			attr_dev(div, "id", "groups");
    			attr_dev(div, "class", "svelte-yid84r");
    			add_location(div, file, 330, 3, 9026);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*PromptToCreateGroup*/ ctx[14], false, false, false),
    					listen_dev(button1, "click", /*click_handler_3*/ ctx[20], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*groups*/ 4) {
    				each_value_1 = Object.entries(/*groups*/ ctx[2]);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(325:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (310:2) {#if focusedGroupId}
    function create_if_block_1(ctx) {
    	let a;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let hr;
    	let t6;
    	let t7;
    	let input;
    	let t8;
    	let button2;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*groups*/ ctx[2][/*focusedGroupId*/ ctx[3]].messages);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "Go Back";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "Kişi Ekle";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Gruptan Çık";
    			t5 = space();
    			hr = element("hr");
    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			input = element("input");
    			t8 = space();
    			button2 = element("button");
    			button2.textContent = "GÖNDER";
    			attr_dev(a, "href", "/#");
    			add_location(a, file, 310, 3, 8313);
    			attr_dev(button0, "class", "svelte-yid84r");
    			add_location(button0, file, 311, 3, 8341);
    			attr_dev(button1, "class", "svelte-yid84r");
    			add_location(button1, file, 312, 3, 8427);
    			add_location(hr, file, 314, 3, 8508);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Mesaj");
    			add_location(input, file, 322, 3, 8715);
    			attr_dev(button2, "class", "svelte-yid84r");
    			add_location(button2, file, 323, 3, 8787);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t6, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t7, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*messageToSend*/ ctx[4]);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, button2, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[16], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[17], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[18]),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[19], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*groups, focusedGroupId, uid, RelativeFormat*/ 8205) {
    				each_value = Object.entries(/*groups*/ ctx[2][/*focusedGroupId*/ ctx[3]].messages);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t7.parentNode, t7);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*messageToSend*/ 16 && input.value !== /*messageToSend*/ ctx[4]) {
    				set_input_value(input, /*messageToSend*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(hr);
    			if (detaching) detach_dev(t6);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(310:2) {#if focusedGroupId}",
    		ctx
    	});

    	return block;
    }

    // (332:4) {#each Object.entries(groups) as [groupId, group]}
    function create_each_block_1(ctx) {
    	let a;
    	let t0_value = Object.values(/*group*/ ctx[37].users) + "";
    	let t0;
    	let t1;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "href", a_href_value = `#${/*groupId*/ ctx[36]}`);
    			attr_dev(a, "class", "linkToGroup svelte-yid84r");
    			add_location(a, file, 332, 5, 9104);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t0);
    			append_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*groups*/ 4 && t0_value !== (t0_value = Object.values(/*group*/ ctx[37].users) + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*groups*/ 4 && a_href_value !== (a_href_value = `#${/*groupId*/ ctx[36]}`)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(332:4) {#each Object.entries(groups) as [groupId, group]}",
    		ctx
    	});

    	return block;
    }

    // (317:3) {#each Object.entries(groups[focusedGroupId].messages) as [sentAt, message]}
    function create_each_block(ctx) {
    	let p;
    	let t0_value = /*RelativeFormat*/ ctx[13](/*sentAt*/ ctx[32]) + "";
    	let t0;
    	let t1;
    	let t2_value = /*message*/ ctx[33].text + "";
    	let t2;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = text(" =- ");
    			t2 = text(t2_value);
    			toggle_class(p, "received", /*message*/ ctx[33].sentBy == /*uid*/ ctx[0]);
    			add_location(p, file, 317, 4, 8600);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*groups, focusedGroupId*/ 12 && t0_value !== (t0_value = /*RelativeFormat*/ ctx[13](/*sentAt*/ ctx[32]) + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*groups, focusedGroupId*/ 12 && t2_value !== (t2_value = /*message*/ ctx[33].text + "")) set_data_dev(t2, t2_value);

    			if (dirty[0] & /*groups, focusedGroupId, uid*/ 13) {
    				toggle_class(p, "received", /*message*/ ctx[33].sentBy == /*uid*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(317:3) {#each Object.entries(groups[focusedGroupId].messages) as [sentAt, message]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*uid*/ ctx[0]) return create_if_block;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "bChat";
    			t1 = space();
    			if_block.c();
    			add_location(h1, file, 306, 1, 8260);
    			attr_dev(main, "class", "svelte-yid84r");
    			add_location(main, file, 305, 0, 8252);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function PromptPhoneNumber() {
    	let phone = prompt("Telefon Numarası");

    	// Remove Whitespace
    	phone = phone.replace(/\s/g, "");

    	// Remove country section
    	if (phone.startsWith("+")) {
    		phone = phone.substring(3);
    	}

    	return parseInt(phone);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let uid = ""; // Example UID: 0bayGCeRXFpwNSJAzW9T
    	const db = firebase.firestore();
    	const auth = firebase.auth();
    	auth.languageCode = "tr";
    	let groups = {}; // History of chats { groupId: { messages: { sentAt: { sendBy, text } } } }
    	let userSubscription = null; // Group subscriptions (call to unsubscribe)
    	let groupSubscriptions = []; // Chat subscriptions (call each to unsubscribe)
    	let focusedGroupId = "";
    	let messageToSend = "";
    	let phoneInput = "";
    	let codeInput = "";
    	let phoneSent = false;
    	let verificationNeeded = false;
    	const usersCollection = db.collection("Users");
    	const groupsCollection = db.collection("Groups");

    	// When URL changes, update focusedGroupId
    	window.addEventListener("hashchange", e => {
    		const hash = window.location.hash.replace("#", "");
    		const groupExists = Object.keys(groups).includes(hash);
    		$$invalidate(3, focusedGroupId = groupExists ? hash : "");
    	});

    	onMount(() => {
    		window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("signIn",
    		{
    				"size": "invisible",
    				"callback": response => {
    					console.log("Recaptcha Verifier Response: ", response);
    				}
    			});
    	});

    	// On Sign In / Out
    	auth.onAuthStateChanged(user => {
    		// Just Signed Out
    		if (!user) {
    			$$invalidate(0, uid = "");
    			return;
    		}

    		// Sign In
    		usersCollection.doc(user.uid).get().then(doc => {
    			if (doc.exists) {
    				// User Already Have An Account, Sign In
    				$$invalidate(0, uid = user.uid);

    				InitializeSubscriptions();
    			} else {
    				// Create An Account & Sign In
    				const data = { displayName: "", groups: [], tel: 0 };

    				data.displayName = prompt("Ad & Soyad");
    				data.tel = parseInt(user.phoneNumber.replace("+90", ""));

    				// Add the 'data' to the firebase
    				usersCollection.doc(user.uid).set(data).then(() => {
    					$$invalidate(0, uid = user.uid);
    					InitializeSubscriptions();
    				});
    			}
    		});
    	});

    	async function SignIn() {
    		// User Sent The Phone Number, Show Loading Screen
    		const phoneNumber = "+90" + phoneInput.split(" ").join("");

    		$$invalidate(7, phoneSent = true);

    		// Server Received The Phone Number, Wait For The SMS Code
    		const result = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);

    		$$invalidate(8, verificationNeeded = true);
    		window.confirmationResult = result;
    	}

    	function ConfirmSMS() {
    		const code = codeInput.split(" ").join("");
    		window.confirmationResult.confirm(code);
    	}

    	// Subscribe to updates on the chats (new messages, new users etc.)
    	// Call this when the user logged in
    	function InitializeSubscriptions() {
    		if (!uid) {
    			return alert("No user logged in!");
    		}

    		// Unsubscribe if already subscribed
    		userSubscription && userSubscription();

    		// Update group subscriptions everytime a new group added or removed.
    		userSubscription = usersCollection.doc(uid).onSnapshot(doc => {
    			// Unsubscribe previous subscriptions
    			for (const unsubscribe of groupSubscriptions) {
    				unsubscribe();
    			}

    			const user = doc.data(); // displayName, tel, groups
    			$$invalidate(2, groups = {});

    			// Update groups array everytime a group gets mutated (a new message arrives)
    			for (const groupId of user.groups) {
    				groupsCollection.doc(groupId).onSnapshot(doc => {
    					if (!doc.exists) {
    						return console.log(groupId, "does not exists!");
    					}

    					const group = doc.data();
    					$$invalidate(2, groups[groupId] = group, groups);
    					const messages = groups[groupId].messages;

    					const orderedMessages = Object.keys(messages).sort().reduce(
    						(obj, key) => {
    							obj[key] = messages[key];
    							return obj;
    						},
    						{}
    					);

    					$$invalidate(2, groups[groupId].messages = orderedMessages, groups);

    					// Convert userArray to userMap ([userId] to {userId: displayName})
    					const userArray = groups[groupId]["users"];

    					const userMap = {};

    					for (const userId of userArray) {
    						usersCollection.doc(userId).get().then(doc => {
    							userMap[userId] = doc.data().displayName;

    							// Mutate groups array so Svelte will re-render.
    							$$invalidate(2, groups);
    						});
    					}

    					$$invalidate(2, groups[groupId]["users"] = userMap, groups);
    				});
    			}
    		});
    	}

    	function SendMessage(groupId, message) {
    		const ref = groupsCollection.doc(groupId);

    		// Strucuture of the generated data
    		// data.messages = { timestamp: { uid, message }, ... }
    		// Generate data
    		const sentAt = Date.now();

    		const data = { messages: {} };
    		data["messages"][sentAt] = {};
    		data["messages"][sentAt]["sentBy"] = uid;
    		data["messages"][sentAt]["text"] = message;

    		// Send the generated data to the firebase
    		ref.set(data, { merge: true });
    	}

    	function AddToGroup(userId, groupId) {
    		const usersDoc = usersCollection.doc(userId);
    		const groupDoc = groupsCollection.doc(groupId);

    		// Add group to the user
    		usersDoc.get().then(doc => {
    			const data = doc.data();
    			data.groups = [...new Set([...data.groups, groupId])];
    			usersDoc.set(data);
    		});

    		// Add user to the group
    		groupDoc.get().then(doc => {
    			const data = doc.data();
    			data.users = [...new Set([...data.users, userId])];
    			groupDoc.set(data);
    		});
    	}

    	async function LeaveGroup(groupId) {
    		if (!confirm("Emin misiniz?")) {
    			return;
    		}

    		await usersCollection.doc(uid).get();
    		const data = doc.data();

    		if (Object.keys(groups[groupId].users).length <= 2) {
    			// Delete Group
    			groupsCollection.doc(groupId).delete().then(() => {
    				console.log("Group Deleted Successfully!");
    			}).catch(err => {
    				console.error("Group Could Not Be Deleted!", error);
    			});

    			// Remove Group From It's Users
    			const usersToUpdate = Object.keys(groups[groupId].users);

    			for (const userId of usersToUpdate) {
    				const ref = usersCollection.doc(userId);

    				ref.get().then(doc => {
    					const data = doc.data();
    					data.groups = data.groups.filter(x => x != groupId);
    					ref.set(data);
    				});
    			}
    		}

    		usersCollection.doc(uid).set(data);

    		// Go back home
    		$$invalidate(3, focusedGroupId = "");
    	}

    	function CreateGroup(secondUserId) {
    		// Empty Group Data Structure (Only initialize 'users')
    		const data = { messages: {}, users: [uid, secondUserId] };

    		// Add the 'data' to the firebase
    		groupsCollection.add(data).then(docRef => {
    			// Add yourself and the secondUser to the group
    			AddToGroup(uid, docRef.id);

    			AddToGroup(secondUserId, docRef.id);
    		});
    	}

    	// Convert Date.now() to Turkish relative time (... ago)
    	function RelativeFormat(timestamp) {
    		const date = toDate(parseInt(timestamp));
    		const dist = formatDistanceToNow(date, { locale: locale$1 }) + " önce";
    		const firstWord = dist.substr(0, dist.indexOf(" "));

    		if (dist == "bir dakikadan az önce") {
    			return "şimdi";
    		}

    		if (firstWord == "yaklaşık") {
    			return dist.substr(dist.indexOf(" ") + 1);
    		} else {
    			return dist;
    		}
    	}

    	async function PromptToCreateGroup() {
    		const phone = PromptPhoneNumber();
    		const uidToAdd = await GetUIDOfPhone(phone);

    		// Given UID does not exists...
    		if (!uidToAdd) {
    			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
    		}

    		// Given UID belogs to the logged in user...
    		if (uidToAdd == uid) {
    			return alert("Kendinizle sohbet başlatamazsınız.");
    		}

    		CreateGroup(uidToAdd);
    	}

    	async function PromptToAddToGroup(groupId) {
    		const phone = PromptPhoneNumber();
    		const uidToAdd = await GetUIDOfPhone(phone);

    		// Given UID does not exists...
    		if (!uidToAdd) {
    			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
    		}

    		const usersOfGroup = Object.keys(groups[groupId].users);
    		const alreadyInGroup = usersOfGroup.includes(uidToAdd);

    		if (alreadyInGroup) {
    			return alert("Kullanıcı zaten grupta.");
    		}

    		AddToGroup(uidToAdd, groupId);
    	}

    	// Gets a phone number and returns UID of related number.
    	function GetUIDOfPhone(phone) {
    		return db.collection("Users").where("tel", "==", phone).get().then(snapshot => {
    			console.log(snapshot);
    			let docId = null;

    			snapshot.forEach(doc => {
    				if (doc.exists) {
    					docId = doc.id;
    				}
    			});

    			return docId;
    		});
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		PromptToAddToGroup(focusedGroupId);
    	};

    	const click_handler_1 = () => {
    		LeaveGroup(focusedGroupId);
    	};

    	function input_input_handler() {
    		messageToSend = this.value;
    		$$invalidate(4, messageToSend);
    	}

    	const click_handler_2 = () => SendMessage(focusedGroupId, messageToSend);

    	const click_handler_3 = () => {
    		auth.signOut();
    	};

    	function input_input_handler_1() {
    		codeInput = this.value;
    		$$invalidate(6, codeInput);
    	}

    	function input_input_handler_2() {
    		phoneInput = this.value;
    		$$invalidate(5, phoneInput);
    	}

    	$$self.$capture_state = () => ({
    		toDate,
    		formatDistanceToNow,
    		tr: locale$1,
    		onMount,
    		uid,
    		db,
    		auth,
    		groups,
    		userSubscription,
    		groupSubscriptions,
    		focusedGroupId,
    		messageToSend,
    		phoneInput,
    		codeInput,
    		phoneSent,
    		verificationNeeded,
    		usersCollection,
    		groupsCollection,
    		SignIn,
    		ConfirmSMS,
    		InitializeSubscriptions,
    		SendMessage,
    		AddToGroup,
    		LeaveGroup,
    		CreateGroup,
    		RelativeFormat,
    		PromptToCreateGroup,
    		PromptToAddToGroup,
    		GetUIDOfPhone,
    		PromptPhoneNumber
    	});

    	$$self.$inject_state = $$props => {
    		if ("uid" in $$props) $$invalidate(0, uid = $$props.uid);
    		if ("groups" in $$props) $$invalidate(2, groups = $$props.groups);
    		if ("userSubscription" in $$props) userSubscription = $$props.userSubscription;
    		if ("groupSubscriptions" in $$props) groupSubscriptions = $$props.groupSubscriptions;
    		if ("focusedGroupId" in $$props) $$invalidate(3, focusedGroupId = $$props.focusedGroupId);
    		if ("messageToSend" in $$props) $$invalidate(4, messageToSend = $$props.messageToSend);
    		if ("phoneInput" in $$props) $$invalidate(5, phoneInput = $$props.phoneInput);
    		if ("codeInput" in $$props) $$invalidate(6, codeInput = $$props.codeInput);
    		if ("phoneSent" in $$props) $$invalidate(7, phoneSent = $$props.phoneSent);
    		if ("verificationNeeded" in $$props) $$invalidate(8, verificationNeeded = $$props.verificationNeeded);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		uid,
    		auth,
    		groups,
    		focusedGroupId,
    		messageToSend,
    		phoneInput,
    		codeInput,
    		phoneSent,
    		verificationNeeded,
    		SignIn,
    		ConfirmSMS,
    		SendMessage,
    		LeaveGroup,
    		RelativeFormat,
    		PromptToCreateGroup,
    		PromptToAddToGroup,
    		click_handler,
    		click_handler_1,
    		input_input_handler,
    		click_handler_2,
    		click_handler_3,
    		input_input_handler_1,
    		input_input_handler_2
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({ target: document.body });

    return app;

}());
//# sourceMappingURL=bundle.js.map
