"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../../opt/npm-tools/node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/helpers/util.js"() {
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
          filtered[k] = obj[k];
        }
        return util2.objectValues(filtered);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = (data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data)) {
            return ZodParsedType.array;
          }
          if (data === null) {
            return ZodParsedType.null;
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    };
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/ZodError.js"() {
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = (obj) => {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/"([^"]+)":/g, "$1:");
    };
    ZodError = class _ZodError extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
          for (const issue of error.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        };
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof _ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    ZodError.create = (issues) => {
      const error = new ZodError(issues);
      return error;
    };
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/locales/en.js"() {
    init_ZodError();
    init_util();
    errorMap = (issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    };
    en_default = errorMap;
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/errors.js"() {
    init_en();
    overrideErrorMap = en_default;
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/helpers/parseUtil.js"() {
    init_errors();
    init_en();
    makeIssue = (params) => {
      const { data, path: path2, errorMaps, issueData } = params;
      const fullPath = [...path2, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    };
    EMPTY_PATH = [];
    ParseStatus = class _ParseStatus {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key, value } = pair;
          if (key.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = (value) => ({ status: "dirty", value });
    OK = (value) => ({ status: "valid", value });
    isAborted = (x) => x.status === "aborted";
    isDirty = (x) => x.status === "dirty";
    isValid = (x) => x.status === "valid";
    isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/helpers/typeAliases.js"() {
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/helpers/errorUtil.js"() {
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema2) {
  if (schema2 instanceof ZodObject) {
    const newShape = {};
    for (const key in schema2.shape) {
      const fieldSchema = schema2.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema2._def,
      shape: () => newShape
    });
  } else if (schema2 instanceof ZodArray) {
    return new ZodArray({
      ...schema2._def,
      type: deepPartialify(schema2.element)
    });
  } else if (schema2 instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodTuple) {
    return ZodTuple.create(schema2.items.map((item) => deepPartialify(item)));
  } else {
    return schema2;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/types.js"() {
    init_ZodError();
    init_errors();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path2, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path2;
        this._key = key;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    handleResult = (ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error = new ZodError(ctx.common.issues);
            this._error = error;
            return this._error;
          }
        };
      }
    };
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check, message) {
        const getIssueProperties = (val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        };
        return this._refinement((val, ctx) => {
          const result = check(val);
          const setError = () => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          });
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data) => {
              if (!data) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data) => this["~validate"](data)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    ZodString = class _ZodString extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.length < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.length > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "length") {
            const tooBig = input.data.length > check.value;
            const tooSmall = input.data.length < check.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              }
              status.dirty();
            }
          } else if (check.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "regex") {
            check.regex.lastIndex = 0;
            const testResult = check.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "trim") {
            input.data = input.data.trim();
          } else if (check.kind === "includes") {
            if (!input.data.includes(check.value, check.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check.value, position: check.position },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check.kind === "startsWith") {
            if (!input.data.startsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "endsWith") {
            if (!input.data.endsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "datetime") {
            const regex = datetimeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "time") {
            const regex = timeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ip") {
            if (!isValidIP(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "jwt") {
            if (!isValidJWT(input.data, check.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cidr") {
            if (!isValidCidr(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check) {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodNumber = class _ZodNumber extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class _ZodBigInt extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (input.data % check.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class _ZodDate extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.getTime() < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check.message,
                inclusive: true,
                exact: false,
                minimum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.getTime() > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check.message,
                inclusive: true,
                exact: false,
                maximum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check) {
        return new _ZodDate({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      min(minDate2, message) {
        return this._addCheck({
          kind: "min",
          value: minDate2.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate2, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate2.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class _ZodArray extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new _ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new _ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new _ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodArray.create = (schema2, params) => {
      return new ZodArray({
        type: schema2,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    ZodObject = class _ZodObject extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key in ctx.data) {
            if (!shapeKeys.includes(key)) {
              extraKeys.push(key);
            }
          }
        }
        const pairs = [];
        for (const key of shapeKeys) {
          const keyValidator = shape[key];
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key },
                value: { status: "valid", value: ctx.data[key] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key of extraKeys) {
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new _ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new _ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key, schema2) {
        return this.augment({ [key]: schema2 });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index) {
        return new _ZodObject({
          ...this._def,
          catchall: index
        });
      }
      pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
          if (mask[key] && this.shape[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (!mask[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key];
          if (mask && !mask[key]) {
            newShape[key] = fieldSchema;
          } else {
            newShape[key] = fieldSchema.optional();
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (mask && !mask[key]) {
            newShape[key] = this.shape[key];
          } else {
            const fieldSchema = this.shape[key];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key] = newField;
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    ZodUnion.create = (types, params) => {
      return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = (type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    };
    ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new _ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class _ZodTuple extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema2 = this._def.items[itemIndex] || this._def.rest;
          if (!schema2)
            return null;
          return schema2._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new _ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    ZodTuple.create = (schemas, params) => {
      if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class _ZodRecord extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new _ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new _ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key = pair.key;
            const value = pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class _ZodSet extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new _ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new _ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class _ZodFunction extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error
            }
          });
        }
        function makeReturnsIssue(returns, error) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error
            }
          });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new _ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new _ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new _ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    ZodEnum = class _ZodEnum extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return _ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    ZodPromise.create = (schema2, params) => {
      return new ZodPromise({
        type: schema2,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = (acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          };
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    ZodEffects.create = (schema2, effect, params) => {
      return new ZodEffects({
        schema: schema2,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema2, params) => {
      return new ZodEffects({
        schema: schema2,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = /* @__PURE__ */ Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    ZodPipeline = class _ZodPipeline extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          };
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new _ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
          if (isValid(data)) {
            data.value = Object.freeze(data.value);
          }
          return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = (cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data) => data instanceof cls, params);
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = () => stringType().optional();
    onumber = () => numberType().optional();
    oboolean = () => booleanType().optional();
    coerce = {
      string: ((arg) => ZodString.create({ ...arg, coerce: true })),
      number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
      boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      })),
      bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
      date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
    };
    NEVER = INVALID;
  }
});

// ../../../opt/npm-tools/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "../../../opt/npm-tools/node_modules/zod/v3/external.js"() {
    init_errors();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types();
    init_ZodError();
  }
});

// ../../../opt/npm-tools/node_modules/zod/index.js
var init_zod = __esm({
  "../../../opt/npm-tools/node_modules/zod/index.js"() {
    init_external();
    init_external();
  }
});

// src/server/config.ts
function loadEnvFile(path2 = ".env") {
  try {
    if (!import_node_fs.default.existsSync(path2)) return;
    for (const line of import_node_fs.default.readFileSync(path2, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      if (process.env[m[1]] === void 0) process.env[m[1]] = v;
    }
  } catch {
  }
}
function config() {
  if (cached) return cached;
  const env = { ...process.env };
  if (!env.APP_URL && env.RENDER_EXTERNAL_URL) env.APP_URL = env.RENDER_EXTERNAL_URL;
  if (env.TRUST_PROXY === void 0 && env.RENDER === "true") env.TRUST_PROXY = "true";
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:
${msg}
See .env.example for the required variables.`);
  }
  cached = parsed.data;
  if (cached.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(cached.APP_URL)) {
    console.warn(`[config] APP_URL is ${cached.APP_URL}. QR codes and links will not open on other devices; set APP_URL to the public address.`);
  }
  return cached;
}
var import_node_fs, schema, cached;
var init_config = __esm({
  "src/server/config.ts"() {
    "use strict";
    import_node_fs = __toESM(require("node:fs"), 1);
    init_zod();
    schema = external_exports.object({
      NODE_ENV: external_exports.enum(["development", "production", "test"]).default("development"),
      PORT: external_exports.coerce.number().int().positive().default(3e3),
      HOST: external_exports.string().default("0.0.0.0"),
      APP_URL: external_exports.string().url().default("http://localhost:3000"),
      DATABASE_URL: external_exports.string().min(1, "DATABASE_URL is required"),
      DATABASE_POOL_MAX: external_exports.coerce.number().int().positive().default(10),
      DATABASE_CA_CERT: external_exports.string().optional(),
      APP_SECRET: external_exports.string().min(32, "APP_SECRET must be at least 32 characters"),
      TRUST_PROXY: external_exports.enum(["true", "false"]).default("false").transform((v) => v === "true"),
      DEMO_MODE: external_exports.enum(["true", "false"]).default("true").transform((v) => v === "true"),
      DEMO_PASSWORD: external_exports.string().min(8).optional(),
      LOG_LEVEL: external_exports.enum(["debug", "info", "warn", "error"]).default("info")
    });
    cached = null;
  }
});

// src/server/db/pg/driver.ts
function parseConnectionString(url) {
  const u = new URL(url);
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  }
  const mode = u.searchParams.get("sslmode") || "prefer";
  const sslmode = mode === "verify-ca" ? "verify-full" : ["disable", "prefer", "require", "verify-full"].includes(mode) ? mode : "prefer";
  return {
    host: decodeURIComponent(u.hostname) || "127.0.0.1",
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    database: decodeURIComponent(u.pathname.replace(/^\//, "") || "postgres"),
    sslmode
  };
}
function parseTimestamptz(s) {
  if (s === "infinity" || s === "-infinity") return s;
  const m = TS_RE.exec(s);
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi, sec, frac, sign, oh, om, os] = m;
  const ms = frac ? Math.round(Number(frac) * 1e3) : 0;
  let t = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec), ms);
  if (sign) {
    const off = (Number(oh) * 3600 + Number(om || 0) * 60 + Number(os || 0)) * 1e3;
    t = sign === "+" ? t - off : t + off;
  }
  return new Date(t);
}
function parseBytea(s) {
  if (s.startsWith("\\x")) return Buffer.from(s.slice(2), "hex");
  return Buffer.from(s.replace(/\\(\d{3})/g, (_m, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\\\/g, "\\"), "binary");
}
function parseArray(s, item) {
  if (s === "{}") return [];
  const out = [];
  let i = 1;
  while (i < s.length - 1) {
    if (s[i] === '"') {
      let v = "";
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\") i++;
        v += s[i];
        i++;
      }
      i++;
      out.push(item(v));
    } else {
      let j = i;
      while (j < s.length - 1 && s[j] !== ",") j++;
      const raw = s.slice(i, j);
      out.push(raw === "NULL" ? null : item(raw));
      i = j;
    }
    if (s[i] === ",") i++;
  }
  return out;
}
function quoteArrayItem(v) {
  if (v === null || v === void 0) return "NULL";
  if (Array.isArray(v)) return toArrayLiteral(v);
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
function toArrayLiteral(arr) {
  return "{" + arr.map(quoteArrayItem).join(",") + "}";
}
function serializeParam(v) {
  if (v === null || v === void 0) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return "\\x" + v.toString("hex");
  if (Array.isArray(v)) return toArrayLiteral(v);
  return JSON.stringify(v);
}
var import_node_net, import_node_tls, import_node_crypto, PgError, TS_RE, num, int8, str, PARSERS, Writer, Connection, Pool;
var init_driver = __esm({
  "src/server/db/pg/driver.ts"() {
    "use strict";
    import_node_net = __toESM(require("node:net"), 1);
    import_node_tls = __toESM(require("node:tls"), 1);
    import_node_crypto = __toESM(require("node:crypto"), 1);
    PgError = class extends Error {
      code;
      detail;
      hint;
      constraint;
      table;
      column;
      severity;
      position;
      constructor(fields) {
        super(fields.M || "PostgreSQL error");
        this.name = "PgError";
        this.code = fields.C;
        this.detail = fields.D;
        this.hint = fields.H;
        this.constraint = fields.n;
        this.table = fields.t;
        this.column = fields.c;
        this.severity = fields.S;
        this.position = fields.P;
      }
    };
    TS_RE = /^(\d{4,})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?(?:([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?|Z)?( BC)?$/;
    num = (v) => Number(v);
    int8 = (v) => {
      const n = Number(v);
      return Number.isSafeInteger(n) ? n : v;
    };
    str = (v) => v;
    PARSERS = {
      16: (v) => v === "t",
      17: parseBytea,
      20: int8,
      21: num,
      23: num,
      26: num,
      700: num,
      701: num,
      1700: num,
      114: (v) => JSON.parse(v),
      3802: (v) => JSON.parse(v),
      1082: str,
      1114: (v) => parseTimestamptz(v + "Z"),
      1184: parseTimestamptz,
      1e3: (v) => parseArray(v, (x) => x === "t"),
      1005: (v) => parseArray(v, num),
      1007: (v) => parseArray(v, num),
      1016: (v) => parseArray(v, int8),
      1009: (v) => parseArray(v, str),
      1015: (v) => parseArray(v, str),
      2951: (v) => parseArray(v, str),
      1182: (v) => parseArray(v, str),
      1185: (v) => parseArray(v, parseTimestamptz),
      3807: (v) => parseArray(v, (x) => JSON.parse(x))
    };
    Writer = class {
      parts = [];
      size = 0;
      int32(n) {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        return this.push(b);
      }
      int16(n) {
        const b = Buffer.alloc(2);
        b.writeInt16BE(n);
        return this.push(b);
      }
      cstr(s) {
        return this.push(Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]));
      }
      bytes(b) {
        return this.push(b);
      }
      push(b) {
        this.parts.push(b);
        this.size += b.length;
        return this;
      }
      /** Build a message with a type byte (or none for startup messages). */
      message(type) {
        const body = Buffer.concat(this.parts, this.size);
        const header = Buffer.alloc(type ? 5 : 4);
        if (type) {
          header.write(type, 0, "ascii");
          header.writeInt32BE(body.length + 4, 1);
        } else {
          header.writeInt32BE(body.length + 4, 0);
        }
        return Buffer.concat([header, body]);
      }
    };
    Connection = class {
      constructor(cfg) {
        this.cfg = cfg;
      }
      cfg;
      socket;
      buf = Buffer.alloc(0);
      queue = [];
      current = null;
      ready = false;
      dead = false;
      lastUsed = Date.now();
      onFatal = null;
      startupResolve = null;
      startupReject = null;
      scram = null;
      async connect() {
        const sock = await this.openSocket();
        this.socket = sock;
        sock.setNoDelay(true);
        sock.on("data", (d) => this.onData(d));
        sock.on("error", (e) => this.fail(e));
        sock.on("close", () => this.fail(new Error("Connection to PostgreSQL closed")));
        await new Promise((resolve, reject) => {
          this.startupResolve = resolve;
          this.startupReject = reject;
          const w = new Writer().int32(196608);
          const params = {
            user: this.cfg.user,
            database: this.cfg.database,
            client_encoding: "UTF8",
            TimeZone: "UTC",
            DateStyle: "ISO, MDY",
            application_name: this.cfg.applicationName || "perkora"
          };
          for (const [k, v] of Object.entries(params)) w.cstr(k).cstr(v);
          w.bytes(Buffer.from([0]));
          sock.write(w.message());
        });
      }
      openSocket() {
        const { host, port, sslmode } = this.cfg;
        const timeout = this.cfg.connectTimeoutMs ?? 1e4;
        return new Promise((resolve, reject) => {
          const raw = import_node_net.default.connect({ host, port });
          const timer = setTimeout(() => {
            raw.destroy();
            reject(new Error(`Timed out connecting to PostgreSQL at ${host}:${port}`));
          }, timeout);
          raw.once("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
          raw.once("connect", () => {
            if (sslmode === "disable") {
              clearTimeout(timer);
              raw.removeAllListeners("error");
              return resolve(raw);
            }
            raw.write(new Writer().int32(80877103).message());
            raw.once("data", (d) => {
              const answer = String.fromCharCode(d[0]);
              if (answer === "S") {
                const secure = import_node_tls.default.connect({
                  socket: raw,
                  servername: import_node_net.default.isIP(host) ? void 0 : host,
                  rejectUnauthorized: sslmode === "verify-full",
                  ca: this.cfg.sslCa
                });
                secure.once("secureConnect", () => {
                  clearTimeout(timer);
                  raw.removeAllListeners("error");
                  secure.removeAllListeners("error");
                  resolve(secure);
                });
                secure.once("error", (e) => {
                  clearTimeout(timer);
                  reject(e);
                });
              } else if (sslmode === "prefer") {
                clearTimeout(timer);
                raw.removeAllListeners("error");
                resolve(raw);
              } else {
                clearTimeout(timer);
                raw.destroy();
                reject(new Error("The PostgreSQL server does not support SSL, but sslmode requires it"));
              }
            });
          });
        });
      }
      fail(e) {
        if (this.dead) return;
        this.dead = true;
        this.ready = false;
        if (this.startupReject) {
          this.startupReject(e);
          this.startupReject = null;
        }
        if (this.current) this.current.reject(e);
        for (const q of this.queue) q.reject(e);
        this.current = null;
        this.queue = [];
        this.onFatal?.(e);
        try {
          this.socket?.destroy();
        } catch {
        }
      }
      setFatalHandler(fn) {
        this.onFatal = fn;
      }
      close() {
        if (this.dead) return;
        try {
          this.socket.write(new Writer().message("X"));
          this.socket.end();
        } catch {
        }
        this.dead = true;
      }
      onData(d) {
        this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
        while (this.buf.length >= 5) {
          const len = this.buf.readInt32BE(1);
          if (this.buf.length < len + 1) break;
          const type = String.fromCharCode(this.buf[0]);
          const body = this.buf.subarray(5, len + 1);
          this.buf = this.buf.subarray(len + 1);
          try {
            this.handle(type, body);
          } catch (e) {
            this.fail(e);
            return;
          }
        }
      }
      handle(type, body) {
        switch (type) {
          case "R":
            return this.handleAuth(body);
          case "S":
          // ParameterStatus
          case "K":
          // BackendKeyData
          case "N":
          // Notice
          case "A":
          // Notification
          case "1":
          // ParseComplete
          case "2":
          // BindComplete
          case "3":
          // CloseComplete
          case "n":
          // NoData
          case "I":
          // EmptyQueryResponse
          case "s":
            return;
          case "T": {
            if (!this.current) return;
            const n = body.readInt16BE(0);
            let off = 2;
            const fields = [];
            for (let i = 0; i < n; i++) {
              const end = body.indexOf(0, off);
              const name = body.toString("utf8", off, end);
              off = end + 1;
              const oid = body.readInt32BE(off + 6);
              off += 18;
              fields.push({ name, oid });
            }
            this.current.fields = fields;
            this.current.rows = [];
            return;
          }
          case "D": {
            const q = this.current;
            if (!q) return;
            const n = body.readInt16BE(0);
            let off = 2;
            const row = {};
            for (let i = 0; i < n; i++) {
              const len = body.readInt32BE(off);
              off += 4;
              const f = q.fields[i];
              if (len === -1) {
                row[f.name] = null;
              } else {
                const raw = body.toString("utf8", off, off + len);
                off += len;
                const p = PARSERS[f.oid];
                row[f.name] = p ? p(raw) : raw;
              }
            }
            q.rows.push(row);
            return;
          }
          case "C": {
            if (!this.current) return;
            const tag = body.toString("utf8", 0, body.length - 1);
            const parts = tag.split(" ");
            this.current.command = parts[0];
            const last = Number(parts[parts.length - 1]);
            this.current.rowCount = Number.isFinite(last) ? last : 0;
            return;
          }
          case "E": {
            const fields = {};
            let off = 0;
            while (off < body.length && body[off] !== 0) {
              const code = String.fromCharCode(body[off]);
              const end = body.indexOf(0, off + 1);
              fields[code] = body.toString("utf8", off + 1, end);
              off = end + 1;
            }
            const err = new PgError(fields);
            if (!this.ready) {
              this.startupReject?.(err);
              this.startupReject = null;
              this.fail(err);
              return;
            }
            if (this.current) this.current.error = err;
            return;
          }
          case "Z": {
            if (!this.ready) {
              this.ready = true;
              this.startupResolve?.();
              this.startupResolve = null;
              this.startupReject = null;
              return;
            }
            const q = this.current;
            this.current = null;
            if (q) {
              if (q.error) q.reject(q.error);
              else q.resolve({ rows: q.rows, rowCount: q.rowCount, command: q.command, fields: q.fields.map((f) => f.name) });
            }
            this.lastUsed = Date.now();
            this.pump();
            return;
          }
          default:
            return;
        }
      }
      handleAuth(body) {
        const code = body.readInt32BE(0);
        const { password, user } = this.cfg;
        if (code === 0) return;
        if (code === 3) {
          this.socket.write(new Writer().cstr(password).message("p"));
          return;
        }
        if (code === 5) {
          const salt = body.subarray(4, 8);
          const inner = import_node_crypto.default.createHash("md5").update(password + user).digest("hex");
          const outer = import_node_crypto.default.createHash("md5").update(Buffer.concat([Buffer.from(inner), salt])).digest("hex");
          this.socket.write(new Writer().cstr("md5" + outer).message("p"));
          return;
        }
        if (code === 10) {
          const mechs = body.toString("utf8", 4).split("\0").filter(Boolean);
          if (!mechs.includes("SCRAM-SHA-256")) throw new Error("Server requires an unsupported SASL mechanism: " + mechs.join(", "));
          const clientNonce = import_node_crypto.default.randomBytes(18).toString("base64");
          const firstBare = "n=*,r=" + clientNonce;
          this.scram = { clientNonce, firstBare };
          const first = Buffer.from("n,," + firstBare, "utf8");
          this.socket.write(new Writer().cstr("SCRAM-SHA-256").int32(first.length).bytes(first).message("p"));
          return;
        }
        if (code === 11) {
          if (!this.scram) throw new Error("Unexpected SASL continue");
          const serverFirst = body.toString("utf8", 4);
          const attrs = Object.fromEntries(serverFirst.split(",").map((kv) => [kv[0], kv.slice(2)]));
          if (!attrs.r?.startsWith(this.scram.clientNonce)) throw new Error("SCRAM: server nonce mismatch");
          const salt = Buffer.from(attrs.s, "base64");
          const iterations = Number(attrs.i);
          const salted = import_node_crypto.default.pbkdf2Sync(password.normalize("NFKC"), salt, iterations, 32, "sha256");
          const clientKey = import_node_crypto.default.createHmac("sha256", salted).update("Client Key").digest();
          const storedKey = import_node_crypto.default.createHash("sha256").update(clientKey).digest();
          const withoutProof = "c=biws,r=" + attrs.r;
          const authMessage = this.scram.firstBare + "," + serverFirst + "," + withoutProof;
          const clientSig = import_node_crypto.default.createHmac("sha256", storedKey).update(authMessage).digest();
          const proof = Buffer.alloc(clientKey.length);
          for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ clientSig[i];
          const serverKey = import_node_crypto.default.createHmac("sha256", salted).update("Server Key").digest();
          this.scram.serverSignature = import_node_crypto.default.createHmac("sha256", serverKey).update(authMessage).digest();
          const final = Buffer.from(withoutProof + ",p=" + proof.toString("base64"), "utf8");
          this.socket.write(new Writer().bytes(final).message("p"));
          return;
        }
        if (code === 12) {
          const serverFinal = body.toString("utf8", 4);
          const v = serverFinal.split(",").find((p) => p.startsWith("v="));
          if (!v || !this.scram?.serverSignature) throw new Error("SCRAM: missing server signature");
          const got = Buffer.from(v.slice(2), "base64");
          if (got.length !== this.scram.serverSignature.length || !import_node_crypto.default.timingSafeEqual(got, this.scram.serverSignature)) {
            throw new Error("SCRAM: server signature mismatch");
          }
          return;
        }
        throw new Error("Unsupported PostgreSQL authentication method: " + code);
      }
      pump() {
        if (this.current || this.dead || !this.ready) return;
        const next = this.queue.shift();
        if (!next) return;
        this.current = next;
        this.socket.write(next.messages);
      }
      query(text, params = []) {
        if (this.dead) return Promise.reject(new Error("Connection is closed"));
        let messages;
        if (params.length === 0 && text.includes(";") && /;\s*\S/.test(text)) {
          messages = new Writer().cstr(text).message("Q");
        } else {
          const parse = new Writer().cstr("").cstr(text).int16(0).message("P");
          const bind = new Writer().cstr("").cstr("").int16(0).int16(params.length);
          for (const p of params) {
            const s = serializeParam(p);
            if (s === null) bind.int32(-1);
            else {
              const b = Buffer.from(s, "utf8");
              bind.int32(b.length).bytes(b);
            }
          }
          bind.int16(0);
          const describe = new Writer().bytes(Buffer.from("P")).cstr("").message("D");
          const execute = new Writer().cstr("").int32(0).message("E");
          const sync = new Writer().message("S");
          messages = Buffer.concat([parse, bind.message("B"), describe, execute, sync]);
        }
        return new Promise((resolve, reject) => {
          this.queue.push({
            messages,
            resolve,
            reject,
            fields: [],
            rows: [],
            command: "",
            rowCount: 0
          });
          this.pump();
        });
      }
    };
    Pool = class {
      constructor(cfg, opts = {}) {
        this.cfg = cfg;
        this.max = opts.max ?? 10;
        this.idleTimeoutMs = opts.idleTimeoutMs ?? 3e4;
        this.acquireTimeoutMs = opts.acquireTimeoutMs ?? 15e3;
        this.reaper = setInterval(() => this.reap(), 1e4);
        this.reaper.unref();
      }
      cfg;
      idle = [];
      total = 0;
      waiters = [];
      closed = false;
      reaper;
      max;
      idleTimeoutMs;
      acquireTimeoutMs;
      get stats() {
        return { total: this.total, idle: this.idle.length, waiting: this.waiters.length };
      }
      reap() {
        const now = Date.now();
        this.idle = this.idle.filter((c) => {
          if (now - c.lastUsed > this.idleTimeoutMs && this.total > 1) {
            c.close();
            this.total--;
            return false;
          }
          return true;
        });
      }
      async create() {
        this.total++;
        const c = new Connection(this.cfg);
        try {
          await c.connect();
        } catch (e) {
          this.total--;
          throw e;
        }
        c.setFatalHandler(() => {
          const i = this.idle.indexOf(c);
          if (i >= 0) this.idle.splice(i, 1);
        });
        return c;
      }
      async acquire() {
        if (this.closed) throw new Error("Pool is closed");
        while (this.idle.length) {
          const c = this.idle.pop();
          if (!c.dead) return c;
          this.total--;
        }
        if (this.total < this.max) return this.create();
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            const i = this.waiters.findIndex((w) => w.timer === timer);
            if (i >= 0) this.waiters.splice(i, 1);
            reject(new Error("Timed out waiting for a database connection"));
          }, this.acquireTimeoutMs);
          this.waiters.push({ resolve, reject, timer });
        });
      }
      releaseConn(c, destroy) {
        if (destroy || c.dead || this.closed) {
          if (!c.dead) c.close();
          this.total--;
          const w2 = this.waiters.shift();
          if (w2) {
            clearTimeout(w2.timer);
            this.create().then(w2.resolve, w2.reject);
          }
          return;
        }
        const w = this.waiters.shift();
        if (w) {
          clearTimeout(w.timer);
          w.resolve(c);
          return;
        }
        this.idle.push(c);
      }
      async connect() {
        const c = await this.acquire();
        let released = false;
        return {
          query: (text, params) => c.query(text, params),
          release: (destroy) => {
            if (released) return;
            released = true;
            this.releaseConn(c, Boolean(destroy));
          }
        };
      }
      async query(text, params) {
        const c = await this.acquire();
        try {
          const r = await c.query(text, params);
          this.releaseConn(c, false);
          return r;
        } catch (e) {
          this.releaseConn(c, c.dead);
          throw e;
        }
      }
      async end() {
        this.closed = true;
        clearInterval(this.reaper);
        for (const c of this.idle) c.close();
        this.idle = [];
        for (const w of this.waiters) {
          clearTimeout(w.timer);
          w.reject(new Error("Pool is closed"));
        }
        this.waiters = [];
      }
    };
  }
});

// src/server/db/index.ts
function getPool() {
  if (pool) return pool;
  const cfg = config();
  const pg = parseConnectionString(cfg.DATABASE_URL);
  if (cfg.DATABASE_CA_CERT) pg.sslCa = cfg.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  pool = new Pool(pg, { max: cfg.DATABASE_POOL_MAX });
  return pool;
}
async function closePool() {
  if (pool) await pool.end();
  pool = null;
}
async function one(q, text, params) {
  const r = await q.query(text, params);
  if (r.rows.length !== 1) throw new Error(`Expected exactly one row, got ${r.rows.length}`);
  return r.rows[0];
}
async function maybeOne(q, text, params) {
  const r = await q.query(text, params);
  return r.rows[0] ?? null;
}
async function many(q, text, params) {
  const r = await q.query(text, params);
  return r.rows;
}
async function tx(fn, opts = {}) {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      client.release();
      return result;
    } catch (e) {
      let broken = false;
      try {
        await client.query("rollback");
      } catch {
        broken = true;
      }
      client.release(broken);
      const code = e.code;
      if ((code === "40001" || code === "40P01") && attempt < retries) continue;
      throw e;
    }
  }
}
function isUniqueViolation(e, constraint) {
  const pe = e;
  return pe?.code === "23505" && (!constraint || pe.constraint === constraint);
}
var pool, db;
var init_db = __esm({
  "src/server/db/index.ts"() {
    "use strict";
    init_driver();
    init_config();
    pool = null;
    db = {
      query: (text, params) => getPool().query(text, params)
    };
  }
});

// src/server/db/migrate.ts
var migrate_exports = {};
__export(migrate_exports, {
  migrate: () => migrate
});
async function migrate(dir = import_node_path.default.resolve(process.cwd(), "migrations"), log = console.log) {
  const pool2 = getPool();
  await pool2.query(`create table if not exists schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  const applied = new Map(
    (await pool2.query("select filename, checksum from schema_migrations")).rows.map((r) => [
      r.filename,
      r.checksum
    ])
  );
  const files = import_node_fs2.default.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  let count = 0;
  for (const file of files) {
    const sql = import_node_fs2.default.readFileSync(import_node_path.default.join(dir, file), "utf8");
    const checksum = import_node_crypto2.default.createHash("sha256").update(sql).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        throw new Error(`Migration ${file} was modified after it was applied. Create a new migration instead.`);
      }
      continue;
    }
    const client = await pool2.connect();
    try {
      await client.query("begin");
      await client.query(sql + "\n;select 1;");
      await client.query("insert into schema_migrations (filename, checksum) values ($1, $2)", [file, checksum]);
      await client.query("commit");
      log(`applied ${file}`);
      count++;
    } catch (e) {
      await client.query("rollback").catch(() => void 0);
      throw new Error(`Migration ${file} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }
  if (!count) log("database is up to date");
  return count;
}
var import_node_fs2, import_node_path, import_node_crypto2;
var init_migrate = __esm({
  "src/server/db/migrate.ts"() {
    "use strict";
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_crypto2 = __toESM(require("node:crypto"), 1);
    init_db();
  }
});

// src/shared/schemas.ts
function parseSettings(raw) {
  const r = businessSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : businessSettingsSchema.parse({});
}
var stampConfigSchema, pointsConfigSchema, SEGMENTS, businessSettingsSchema, grantSchema, campaignBenefitSchema, campaignEligibilitySchema, referralConfigSchema, planFeaturesSchema;
var init_schemas = __esm({
  "src/shared/schemas.ts"() {
    "use strict";
    init_zod();
    stampConfigSchema = external_exports.object({
      stampsRequired: external_exports.number().int().min(2).max(30),
      eligiblePurchase: external_exports.string().trim().min(2).max(120),
      maxStampsPerTransaction: external_exports.number().int().min(1).max(10).default(1),
      allowWithOtherPromotions: external_exports.boolean().default(false)
    });
    pointsConfigSchema = external_exports.object({
      earnMode: external_exports.enum(["per_currency_unit", "per_purchase"]),
      pointsPerUnit: external_exports.number().int().min(1).max(100).default(1),
      pointsPerPurchase: external_exports.number().int().min(1).max(1e3).default(10),
      minSpendMinor: external_exports.number().int().min(0).max(1e7).default(0),
      maxPointsPerTransaction: external_exports.number().int().min(1).max(1e5).default(500),
      eligiblePurchase: external_exports.string().trim().min(2).max(120),
      allowWithOtherPromotions: external_exports.boolean().default(false)
    });
    SEGMENTS = ["all", "new", "active", "frequent", "approaching", "unused_rewards", "inactive", "no_visits"];
    businessSettingsSchema = external_exports.object({
      inactivityDays: external_exports.number().int().min(7).max(365).default(21),
      newMemberDays: external_exports.number().int().min(7).max(120).default(30),
      frequentVisits: external_exports.number().int().min(2).max(60).default(4),
      approachingStamps: external_exports.number().int().min(1).max(10).default(2),
      visitWindowMinutes: external_exports.number().int().min(15).max(720).default(120),
      duplicateGuardSeconds: external_exports.number().int().min(0).max(3600).default(60),
      refundPolicy: external_exports.enum(["reverse", "keep"]).default("reverse"),
      staffInstructions: external_exports.string().max(1e3).default(""),
      operationalAlerts: external_exports.boolean().default(true),
      showOffersPublicly: external_exports.boolean().default(true)
    });
    grantSchema = external_exports.discriminatedUnion("kind", [
      external_exports.object({ kind: external_exports.literal("voucher"), rewardId: external_exports.string().uuid() }),
      external_exports.object({ kind: external_exports.literal("bonus"), programmeId: external_exports.string().uuid(), amount: external_exports.number().int().min(1).max(1e4) })
    ]);
    campaignBenefitSchema = external_exports.discriminatedUnion("kind", [
      external_exports.object({ kind: external_exports.literal("none") }),
      external_exports.object({ kind: external_exports.literal("voucher"), rewardId: external_exports.string().uuid() }),
      external_exports.object({
        kind: external_exports.literal("bonus"),
        programmeId: external_exports.string().uuid(),
        mode: external_exports.enum(["flat", "multiplier"]).default("flat"),
        amount: external_exports.number().int().min(1).max(1e4)
      })
    ]);
    campaignEligibilitySchema = external_exports.object({
      weekdays: external_exports.array(external_exports.number().int().min(1).max(7)).max(7).optional(),
      startTime: external_exports.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: external_exports.string().regex(/^\d{2}:\d{2}$/).optional()
    });
    referralConfigSchema = external_exports.object({
      referrerGrant: grantSchema,
      referredGrant: grantSchema,
      maxPerReferrer: external_exports.number().int().min(1).max(100).default(5)
    });
    planFeaturesSchema = external_exports.object({
      features: external_exports.object({
        stamps: external_exports.boolean().default(true),
        points: external_exports.boolean().default(false),
        challenges: external_exports.boolean().default(false),
        offers: external_exports.boolean().default(false),
        campaigns: external_exports.boolean().default(false),
        referrals: external_exports.boolean().default(false),
        segments: external_exports.boolean().default(false),
        inactiveReport: external_exports.boolean().default(false),
        advancedInsights: external_exports.boolean().default(false),
        flexibleCampaignRules: external_exports.boolean().default(false),
        automatedWinback: external_exports.boolean().default(false),
        advancedReports: external_exports.boolean().default(false),
        csvExport: external_exports.boolean().default(true),
        prioritySupport: external_exports.boolean().default(false)
      }).default({}),
      limits: external_exports.object({
        locations: external_exports.number().int().min(1).default(1),
        programmes: external_exports.number().int().min(1).default(1),
        staffSeats: external_exports.number().int().min(1).default(3),
        activeCampaigns: external_exports.number().int().min(0).default(0)
      }).default({}),
      highlights: external_exports.array(external_exports.string()).default([]),
      inheritsFrom: external_exports.string().nullable().default(null)
    });
  }
});

// src/server/domain/plans.ts
var DEFAULT_PLANS;
var init_plans = __esm({
  "src/server/domain/plans.ts"() {
    "use strict";
    init_db();
    init_schemas();
    DEFAULT_PLANS = [
      {
        id: "starter",
        name: "Starter",
        description: "A digital stamp card for one caf\xE9.",
        monthly_price_minor: 900,
        is_recommended: false,
        sort_order: 1,
        feature_configuration: {
          features: { stamps: true, csvExport: true },
          limits: { locations: 1, programmes: 1, staffSeats: 2, activeCampaigns: 0 },
          inheritsFrom: null,
          highlights: [
            "One caf\xE9 location",
            "One digital loyalty programme",
            "Digital stamp card",
            "Basic rewards",
            "QR-code enrolment",
            "Basic customer list",
            "Basic visit and redemption reporting"
          ],
          highlightsTr: [
            "Bir kafe \u015Fubesi",
            "Bir dijital sadakat program\u0131",
            "Dijital damga kart\u0131",
            "Temel \xF6d\xFCller",
            "QR kod ile kat\u0131l\u0131m",
            "Temel m\xFC\u015Fteri listesi",
            "Temel ziyaret ve \xF6d\xFCl kullan\u0131m raporlar\u0131"
          ]
        }
      },
      {
        id: "growth",
        name: "Growth",
        description: "Points, streaks and offers to bring regulars back.",
        monthly_price_minor: 1900,
        is_recommended: true,
        sort_order: 2,
        feature_configuration: {
          features: { stamps: true, points: true, challenges: true, offers: true, campaigns: true, referrals: true, segments: true, inactiveReport: true, csvExport: true },
          limits: { locations: 1, programmes: 2, staffSeats: 5, activeCampaigns: 5 },
          inheritsFrom: "Starter",
          highlights: [
            "Points-based loyalty",
            "Configurable visit streaks",
            "Promotional offers",
            "Referral functionality",
            "Customer segmentation",
            "Inactive-customer reporting",
            "Campaign management",
            "Improved analytics"
          ],
          highlightsTr: [
            "Puan tabanl\u0131 sadakat",
            "Ayarlanabilir ziyaret serileri",
            "Promosyon teklifleri",
            "Arkada\u015F getirme \xF6zelli\u011Fi",
            "M\xFC\u015Fteri segmentasyonu",
            "Gelmeyen m\xFC\u015Fteri raporlar\u0131",
            "Kampanya y\xF6netimi",
            "Geli\u015Fmi\u015F analizler"
          ]
        }
      },
      {
        id: "premium",
        name: "Premium",
        description: "Deeper insights and more flexible campaigns.",
        monthly_price_minor: 3500,
        is_recommended: false,
        sort_order: 3,
        feature_configuration: {
          features: {
            stamps: true,
            points: true,
            challenges: true,
            offers: true,
            campaigns: true,
            referrals: true,
            segments: true,
            inactiveReport: true,
            advancedInsights: true,
            flexibleCampaignRules: true,
            automatedWinback: true,
            advancedReports: true,
            csvExport: true,
            prioritySupport: true
          },
          limits: { locations: 1, programmes: 4, staffSeats: 15, activeCampaigns: 20 },
          inheritsFrom: "Growth",
          highlights: [
            "Advanced customer insights",
            "More flexible campaign rules",
            "Automated win-back campaigns, when the required messaging service is configured",
            "Advanced reports",
            "Additional staff management capabilities",
            "Priority support"
          ],
          highlightsTr: [
            "Geli\u015Fmi\u015F m\xFC\u015Fteri i\xE7g\xF6r\xFCleri",
            "Daha esnek kampanya kurallar\u0131",
            "Gerekli mesajla\u015Fma hizmeti yap\u0131land\u0131r\u0131ld\u0131\u011F\u0131nda otomatik geri kazanma kampanyalar\u0131",
            "Geli\u015Fmi\u015F raporlar",
            "Ek personel y\xF6netimi olanaklar\u0131",
            "\xD6ncelikli destek"
          ]
        }
      }
    ];
  }
});

// src/server/auth/crypto.ts
function scrypt(password, salt, n, r, p) {
  return new Promise(
    (resolve, reject) => import_node_crypto3.default.scrypt(
      password.normalize("NFKC"),
      salt,
      KEYLEN,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => err ? reject(err) : resolve(key)
    )
  );
}
async function hashPassword(password) {
  const salt = import_node_crypto3.default.randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}
function randomCode(length) {
  let out = "";
  const limit = 256 - 256 % CODE_ALPHABET.length;
  while (out.length < length) {
    for (const b of import_node_crypto3.default.randomBytes(length * 2)) {
      if (b < limit) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}
var import_node_crypto3, N, R, P, KEYLEN, CODE_ALPHABET;
var init_crypto = __esm({
  "src/server/auth/crypto.ts"() {
    "use strict";
    import_node_crypto3 = __toESM(require("node:crypto"), 1);
    N = 16384;
    R = 8;
    P = 1;
    KEYLEN = 64;
    CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  }
});

// src/server/domain/errors.ts
var DomainError, notFound;
var init_errors2 = __esm({
  "src/server/domain/errors.ts"() {
    "use strict";
    DomainError = class extends Error {
      constructor(code, message, status = 400, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = "DomainError";
      }
      code;
      status;
      details;
    };
    notFound = (what = "Record") => new DomainError("not_found", `${what} not found`, 404);
  }
});

// src/server/domain/accounts.ts
async function createUser(q, input) {
  try {
    const u = await one(
      q,
      `insert into users (name, email, locale, is_demo, platform_role) values ($1, $2, $3, $4, $5) returning id`,
      [input.name, input.email.toLowerCase(), input.locale ?? "en", input.isDemo ?? false, input.platformRole ?? null]
    );
    await q.query(`insert into user_credentials (user_id, password_hash) values ($1, $2)`, [u.id, await hashPassword(input.password)]);
    return u;
  } catch (e) {
    if (isUniqueViolation(e, "users_email_key")) throw new DomainError("conflict", "An account with this email already exists.", 409);
    throw e;
  }
}
var emailSchema, passwordSchema, nameSchema, signUpSchema;
var init_accounts = __esm({
  "src/server/domain/accounts.ts"() {
    "use strict";
    init_zod();
    init_db();
    init_crypto();
    init_errors2();
    emailSchema = external_exports.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
    passwordSchema = external_exports.string().min(10, "Use at least 10 characters.").max(200, "That password is too long.");
    nameSchema = external_exports.string().trim().min(1, "Enter your name.").max(120, "That name is too long.");
    signUpSchema = external_exports.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
  }
});

// src/shared/time.ts
function partsFormatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23"
    });
    fmtCache.set(tz, f);
  }
  return f;
}
function localParts(d, tz) {
  const parts = {};
  for (const p of partsFormatter(tz).formatToParts(d)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday) + 1
  };
}
function localDate(d, tz) {
  return localParts(d, tz).date;
}
function toUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUtc(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = toUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}
function weekdayOf(dateStr) {
  const wd = toUtc(dateStr).getUTCDay();
  return wd === 0 ? 7 : wd;
}
function weekRange(dateStr) {
  const start = addDays(dateStr, 1 - weekdayOf(dateStr));
  return [start, addDays(start, 6)];
}
function monthRange(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = fromUtc(new Date(Date.UTC(y, m, 0)));
  return [start, end];
}
function isoWeekKey(dateStr) {
  const d = toUtc(dateStr);
  const wd = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wd);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function maxDate(a, b) {
  return a > b ? a : b;
}
function minDate(a, b) {
  return a < b ? a : b;
}
var fmtCache, WEEKDAYS;
var init_time = __esm({
  "src/shared/time.ts"() {
    "use strict";
    fmtCache = /* @__PURE__ */ new Map();
    WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }
});

// src/server/domain/segments.ts
function paramBuilder(initial = []) {
  const params = [...initial];
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  return { params, p };
}
function isSegment(s) {
  return typeof s === "string" && SEGMENTS.includes(s);
}
function segmentPredicate(segment, s, now, p, m = "m") {
  const nowP = () => `${p(now)}::timestamptz`;
  switch (segment) {
    case "all":
      return "true";
    case "new":
      return `${m}.joined_at >= ${nowP()} - make_interval(days => ${p(s.newMemberDays)}::int)`;
    case "active":
      return `${m}.last_visit_at >= ${nowP()} - make_interval(days => ${p(s.inactivityDays)}::int)`;
    case "frequent":
      return `(select count(*) from visits v where v.membership_id = ${m}.id and v.occurred_at >= ${nowP()} - interval '30 days' and v.occurred_at <= ${nowP()}) >= ${p(s.frequentVisits)}::int`;
    case "approaching":
      return `(exists (
        select 1 from membership_balances b
        join loyalty_programmes lp on lp.id = b.programme_id
        where b.membership_id = ${m}.id and lp.status = 'active' and lp.programme_type = 'stamps'
          and (lp.config->>'stampsRequired')::int - b.balance between 1 and ${p(s.approachingStamps)}::int)
      or exists (
        select 1 from membership_balances b
        join loyalty_programmes lp on lp.id = b.programme_id
        join rewards r on r.programme_id = lp.id and r.status = 'active' and r.points_cost is not null
        where b.membership_id = ${m}.id and lp.status = 'active' and lp.programme_type = 'points'
          and b.balance < r.points_cost and b.balance >= ceil(r.points_cost * 0.8)))`;
    case "unused_rewards":
      return `exists (select 1 from customer_rewards cr where cr.membership_id = ${m}.id and cr.status = 'available' and (cr.expires_at is null or cr.expires_at > ${nowP()}))`;
    case "inactive":
      return `(${m}.visit_count > 0 and ${m}.last_visit_at < ${nowP()} - make_interval(days => ${p(s.inactivityDays)}::int))`;
    case "no_visits":
      return `${m}.visit_count = 0`;
  }
}
async function memberInSegment(q, businessId, membershipId, segment, settings, now) {
  if (segment === "all") return true;
  const { params, p } = paramBuilder([membershipId, businessId]);
  const pred = segmentPredicate(segment, settings, now, p);
  const r = await maybeOne(
    q,
    `select exists (select 1 from loyalty_memberships m where m.id = $1 and m.business_id = $2 and m.status = 'active' and ${pred}) as ok`,
    params
  );
  return Boolean(r?.ok);
}
var init_segments = __esm({
  "src/server/domain/segments.ts"() {
    "use strict";
    init_db();
    init_schemas();
  }
});

// src/server/domain/loyalty.ts
async function loadBusinessCtx(q, businessId, requireActive = true) {
  const b = await maybeOne(
    q,
    "select id, name, status, timezone, default_currency, settings from businesses where id = $1",
    [businessId]
  );
  if (!b) throw notFound("Caf\xE9");
  if (requireActive && b.status !== "active") {
    throw new DomainError("business_inactive", "This caf\xE9\u2019s loyalty programme is not active right now.", 403);
  }
  return {
    id: b.id,
    name: b.name,
    status: b.status,
    timezone: b.timezone,
    currency: b.default_currency,
    settings: parseSettings(b.settings)
  };
}
async function lockMembership(q, businessId, membershipId) {
  const m = await maybeOne(
    q,
    `select id, business_id, customer_id, status, visit_count, last_visit_at, joined_at, referred_by_membership_id
       from loyalty_memberships where id = $1 and business_id = $2 for no key update`,
    [membershipId, businessId]
  );
  if (!m) throw notFound("Member");
  if (m.status !== "active") {
    throw new DomainError("membership_inactive", "This membership is not active.", 409);
  }
  return m;
}
async function loadProgramme(q, businessId, programmeId) {
  const p = await maybeOne(
    q,
    `select id, business_id, name, programme_type, config, status, start_date, end_date
       from loyalty_programmes where id = $1 and business_id = $2`,
    [programmeId, businessId]
  );
  if (!p) throw notFound("Loyalty programme");
  return p;
}
function assertProgrammeRunning(p, today) {
  if (p.status !== "active") throw new DomainError("programme_inactive", `${p.name} is not active.`, 409);
  if (p.start_date && today < p.start_date) throw new DomainError("programme_inactive", `${p.name} starts on ${p.start_date}.`, 409);
  if (p.end_date && today > p.end_date) throw new DomainError("programme_inactive", `${p.name} ended on ${p.end_date}.`, 409);
}
function stampConfig(p) {
  return stampConfigSchema.parse(p.config);
}
function pointsConfig(p) {
  return pointsConfigSchema.parse(p.config);
}
async function beginOperation(q, args) {
  if (!args.key || args.key.length < 8 || args.key.length > 120) {
    throw new DomainError("validation", "A valid idempotency key is required.", 400);
  }
  const ins = await q.query(
    `insert into loyalty_operations (business_id, membership_id, kind, idempotency_key, actor_user_id, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, idempotency_key) do nothing
     returning id`,
    [args.businessId, args.membershipId, args.kind, args.key, args.actorUserId, args.now]
  );
  if (ins.rows[0]) return { id: ins.rows[0].id, duplicate: false };
  const ex = await one(
    q,
    "select id, kind, membership_id, result from loyalty_operations where business_id = $1 and idempotency_key = $2",
    [args.businessId, args.key]
  );
  if (ex.kind !== args.kind || args.membershipId && ex.membership_id !== args.membershipId) {
    throw new DomainError("idempotency_conflict", "This request key was already used for a different action.", 409);
  }
  return { id: ex.id, duplicate: true, result: ex.result };
}
async function finishOperation(q, id, result) {
  await q.query("update loyalty_operations set result = $2 where id = $1", [id, result]);
}
async function lockBalance(q, businessId, membershipId, programmeId) {
  await q.query(
    `insert into membership_balances (membership_id, programme_id, business_id) values ($1, $2, $3)
     on conflict (membership_id, programme_id) do nothing`,
    [membershipId, programmeId, businessId]
  );
  const r = await one(
    q,
    "select balance from membership_balances where membership_id = $1 and programme_id = $2 and business_id = $3 for update",
    [membershipId, programmeId, businessId]
  );
  return r.balance;
}
async function changeBalance(q, a) {
  const r = await one(
    q,
    `update membership_balances
        set balance = balance + $4,
            lifetime_earned = greatest(0, lifetime_earned + $5),
            lifetime_spent = greatest(0, lifetime_spent + $6),
            updated_at = $7
      where membership_id = $1 and programme_id = $2 and business_id = $3
      returning balance`,
    [a.membershipId, a.programmeId, a.businessId, a.delta, a.earned ?? 0, a.spent ?? 0, a.now]
  );
  return r.balance;
}
async function insertTxn(q, t) {
  const points = t.programmeType === "points" ? t.delta : 0;
  const stamps = t.programmeType === "stamps" ? t.delta : 0;
  try {
    const r = await one(
      q,
      `insert into loyalty_transactions
        (business_id, membership_id, programme_id, operation_id, transaction_type, points_delta, stamps_delta, balance_after,
         source, reference_id, purchase_amount_minor, currency, visit_id, campaign_id, challenge_id, customer_reward_id,
         redemption_id, reverses_transaction_id, actor_user_id, description, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       returning id`,
      [
        t.businessId,
        t.membershipId,
        t.programmeId,
        t.operationId,
        t.type,
        points,
        stamps,
        t.balanceAfter,
        t.source,
        t.referenceId ?? null,
        t.amountMinor ?? null,
        t.currency ?? null,
        t.visitId ?? null,
        t.campaignId ?? null,
        t.challengeId ?? null,
        t.customerRewardId ?? null,
        t.redemptionId ?? null,
        t.reversesId ?? null,
        t.actorUserId,
        t.description,
        t.now
      ]
    );
    return r.id;
  } catch (e) {
    if (isUniqueViolation(e, "loyalty_transactions_purchase_ref_key")) {
      throw new DomainError("duplicate_purchase", "This purchase reference has already earned credit.", 409);
    }
    if (isUniqueViolation(e, "loyalty_transactions_reverses_transaction_id_key")) {
      throw new DomainError("already_reversed", "This transaction has already been reversed.", 409);
    }
    throw e;
  }
}
async function voucherExpiry(q, tz, now, validityDays, endDates) {
  const candidates = endDates.filter((d) => Boolean(d));
  if (validityDays) candidates.push(localDate(new Date(now.getTime() + validityDays * 864e5), tz));
  if (!candidates.length) return null;
  candidates.sort();
  const r = await one(q, `select (($1::date + 1)::timestamp at time zone $2) as t`, [candidates[0], tz]);
  return r.t;
}
async function loadReward(q, businessId, rewardId) {
  const r = await maybeOne(
    q,
    `select id, business_id, programme_id, name, status, points_cost, stamps_cost, validity_days, start_date, end_date,
            per_customer_limit, total_limit, is_card_reward
       from rewards where id = $1 and business_id = $2`,
    [rewardId, businessId]
  );
  if (!r) throw notFound("Reward");
  return r;
}
async function rewardBlocker(q, reward, membershipId, today) {
  if (reward.status !== "active") return "reward_unavailable";
  if (reward.start_date && today < reward.start_date) return "reward_not_started";
  if (reward.end_date && today > reward.end_date) return "reward_expired";
  if (reward.per_customer_limit || reward.total_limit) {
    await q.query("select pg_advisory_xact_lock(hashtext($1))", ["reward:" + reward.id]);
    const c = await one(
      q,
      `select count(*) filter (where membership_id = $2) as mine, count(*) as total
         from customer_rewards where reward_id = $1 and status <> 'void'`,
      [reward.id, membershipId]
    );
    if (reward.per_customer_limit && c.mine >= reward.per_customer_limit) return "limit_reached";
    if (reward.total_limit && c.total >= reward.total_limit) return "limit_reached";
  }
  return null;
}
async function issueVoucher(q, a) {
  const expiresAt = await voucherExpiry(q, a.biz.timezone, a.now, a.reward.validity_days, [
    a.reward.end_date,
    ...a.extraEndDates ?? []
  ]);
  const r = await one(
    q,
    `insert into customer_rewards (business_id, membership_id, reward_id, source, source_ref_id, operation_id, status, issued_at, expires_at, created_at)
     values ($1, $2, $3, $4, $5, $6, 'available', $7, $8, $7) returning id`,
    [a.biz.id, a.membershipId, a.reward.id, a.source, a.sourceRefId ?? null, a.operationId, a.now, expiresAt]
  );
  return {
    id: r.id,
    rewardId: a.reward.id,
    rewardName: a.reward.name,
    source: a.source,
    expiresAt: expiresAt ? expiresAt.toISOString() : null
  };
}
async function cardReward(q, businessId, programmeId) {
  const r = await maybeOne(
    q,
    `select id from rewards where business_id = $1 and programme_id = $2 and is_card_reward and status <> 'archived'
      order by created_at limit 1`,
    [businessId, programmeId]
  );
  return r ? loadReward(q, businessId, r.id) : null;
}
async function completeStampCards(q, a, notices) {
  const cfg = stampConfig(a.programme);
  const today = localDate(a.now, a.biz.timezone);
  const vouchers = [];
  let balance = await lockBalance(q, a.biz.id, a.membershipId, a.programme.id);
  for (let i = 0; i < 10 && balance >= cfg.stampsRequired; i++) {
    const reward = await cardReward(q, a.biz.id, a.programme.id);
    const blocker = reward ? await rewardBlocker(q, reward, a.membershipId, today) : "reward_unavailable";
    if (!reward || blocker) {
      notices.push("card_full_reward_unavailable");
      break;
    }
    const voucher = await issueVoucher(q, {
      biz: a.biz,
      membershipId: a.membershipId,
      reward,
      source: "stamp_card",
      sourceRefId: a.programme.id,
      operationId: a.operationId,
      now: a.now
    });
    balance = await changeBalance(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: a.programme.id,
      delta: -cfg.stampsRequired,
      spent: cfg.stampsRequired,
      now: a.now
    });
    await insertTxn(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: a.programme.id,
      programmeType: "stamps",
      operationId: a.operationId,
      type: "card_completed",
      delta: -cfg.stampsRequired,
      balanceAfter: balance,
      source: a.source === "seed" ? "seed" : "system",
      description: `Card completed: ${reward.name} unlocked`,
      actorUserId: a.actorUserId,
      customerRewardId: voucher.id,
      now: a.now
    });
    vouchers.push(voucher);
  }
  return { vouchers, balance };
}
async function applyGrant(q, a, notices) {
  const today = localDate(a.now, a.biz.timezone);
  if (a.grant.kind === "voucher") {
    const reward = await loadReward(q, a.biz.id, a.grant.rewardId);
    const blocker = await rewardBlocker(q, reward, a.membershipId, today);
    if (blocker) {
      notices.push(`grant_skipped:${blocker}`);
      return null;
    }
    const voucher = await issueVoucher(q, {
      biz: a.biz,
      membershipId: a.membershipId,
      reward,
      source: a.voucherSource,
      sourceRefId: a.sourceRefId ?? a.campaignId ?? a.challengeId ?? null,
      operationId: a.operationId,
      now: a.now,
      extraEndDates: a.extraEndDates
    });
    await insertTxn(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: reward.programme_id,
      programmeType: null,
      operationId: a.operationId,
      type: "voucher_issued",
      delta: 0,
      balanceAfter: null,
      source: a.txnSource,
      description: `${a.description}: ${reward.name}`,
      actorUserId: a.actorUserId,
      campaignId: a.campaignId,
      challengeId: a.challengeId,
      customerRewardId: voucher.id,
      now: a.now
    });
    return { kind: "voucher", description: reward.name, voucher };
  }
  const programme = await loadProgramme(q, a.biz.id, a.grant.programmeId);
  if (programme.status !== "active") {
    notices.push("grant_skipped:programme_inactive");
    return null;
  }
  await lockBalance(q, a.biz.id, a.membershipId, programme.id);
  const balance = await changeBalance(q, {
    businessId: a.biz.id,
    membershipId: a.membershipId,
    programmeId: programme.id,
    delta: a.grant.amount,
    earned: a.grant.amount,
    now: a.now
  });
  const unit = programme.programme_type === "stamps" ? a.grant.amount === 1 ? "stamp" : "stamps" : "points";
  await insertTxn(q, {
    businessId: a.biz.id,
    membershipId: a.membershipId,
    programmeId: programme.id,
    programmeType: programme.programme_type,
    operationId: a.operationId,
    type: a.txnType,
    delta: a.grant.amount,
    balanceAfter: balance,
    source: a.txnSource,
    description: `${a.description}: +${a.grant.amount} ${unit}`,
    actorUserId: a.actorUserId,
    campaignId: a.campaignId,
    challengeId: a.challengeId,
    now: a.now
  });
  let vouchers = [];
  if (programme.programme_type === "stamps") {
    vouchers = (await completeStampCards(
      q,
      { biz: a.biz, membershipId: a.membershipId, programme, operationId: a.operationId, actorUserId: a.actorUserId, source: a.txnSource, now: a.now },
      notices
    )).vouchers;
  }
  return { kind: "bonus", description: `+${a.grant.amount} ${unit}`, amount: a.grant.amount, programmeId: programme.id, vouchers };
}
async function runningCampaigns(q, businessId, today, types) {
  return many(
    q,
    `select ${CAMPAIGN_COLS} from campaigns
      where business_id = $1 and status = 'published' and campaign_type = any($2::text[])
        and start_date <= $3 and (end_date is null or end_date >= $3)
      order by created_at`,
    [businessId, types, today]
  );
}
function withinEligibilityWindow(c, now, tz) {
  const e = campaignEligibilitySchema.safeParse(c.eligibility ?? {});
  if (!e.success) return false;
  const lp = localParts(now, tz);
  if (e.data.weekdays?.length && !e.data.weekdays.includes(lp.weekday)) return false;
  if (e.data.startTime || e.data.endTime) {
    const mins = lp.hour * 60 + lp.minute;
    const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    if (e.data.startTime && mins < toMin(e.data.startTime)) return false;
    if (e.data.endTime && mins >= toMin(e.data.endTime)) return false;
  }
  return true;
}
async function campaignUsage(q, campaignId, membershipId, eventType) {
  await q.query("select pg_advisory_xact_lock(hashtext($1))", ["campaign:" + campaignId]);
  return one(
    q,
    `select count(*) filter (where membership_id = $2) as mine, count(*) as total
       from campaign_events where campaign_id = $1 and event_type = $3`,
    [campaignId, membershipId, eventType]
  );
}
async function recordCampaignEvent(q, a) {
  const r = await q.query(
    `insert into campaign_events (business_id, campaign_id, membership_id, customer_id, event_type, dedupe_key, operation_id, event_data, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (campaign_id, membership_id, event_type, dedupe_key) do nothing returning id`,
    [a.businessId, a.campaignId, a.membershipId, a.customerId ?? null, a.type, a.dedupeKey, a.operationId ?? null, a.data ?? {}, a.now]
  );
  return r.rows.length === 1;
}
async function awardPurchase(q, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: input.membershipId,
    kind: "award",
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now
  });
  if (op.duplicate) return { ...op.result, duplicate: true };
  const member = await lockMembership(q, biz.id, input.membershipId);
  const programme = await loadProgramme(q, biz.id, input.programmeId);
  const lp = localParts(now, biz.timezone);
  const today = lp.date;
  assertProgrammeRunning(programme, today);
  const notices = [];
  let credit;
  let amountMinor = null;
  let currency = null;
  const cfgAllowPromo = Boolean(programme.config?.allowWithOtherPromotions);
  if (input.usedOtherPromotion && !cfgAllowPromo) {
    throw new DomainError(
      "promotion_not_combinable",
      "This programme does not give credit for purchases already discounted by another promotion.",
      422
    );
  }
  if (programme.programme_type === "stamps") {
    const cfg = stampConfig(programme);
    const qty = input.quantity ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > cfg.maxStampsPerTransaction) {
      throw new DomainError(
        "invalid_quantity",
        `Between 1 and ${cfg.maxStampsPerTransaction} stamp${cfg.maxStampsPerTransaction === 1 ? "" : "s"} can be added per purchase.`,
        422,
        { max: cfg.maxStampsPerTransaction }
      );
    }
    credit = qty;
  } else {
    const cfg = pointsConfig(programme);
    if (cfg.earnMode === "per_currency_unit") {
      const amt = input.amountMinor;
      if (!Number.isInteger(amt) || amt <= 0) {
        throw new DomainError("invalid_amount", "Enter the purchase amount.", 422);
      }
      currency = input.currency ?? biz.currency;
      if (currency !== biz.currency) {
        throw new DomainError("currency_mismatch", `Amounts must be entered in ${biz.currency}. Perkora does not convert currencies.`, 422);
      }
      if (amt < cfg.minSpendMinor) {
        throw new DomainError("below_min_spend", "This purchase is below the minimum spend for points.", 422, {
          minSpendMinor: cfg.minSpendMinor
        });
      }
      amountMinor = amt;
      credit = Math.floor(amountMinor * cfg.pointsPerUnit / 100);
      if (credit < 1) throw new DomainError("invalid_amount", "This amount is too small to earn points.", 422);
    } else {
      const qty = input.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
        throw new DomainError("invalid_quantity", "Between 1 and 10 qualifying purchases can be recorded at once.", 422, { max: 10 });
      }
      credit = qty * cfg.pointsPerPurchase;
      if (Number.isInteger(input.amountMinor) && input.amountMinor > 0) {
        amountMinor = input.amountMinor;
        currency = biz.currency;
      }
    }
    if (credit > cfg.maxPointsPerTransaction) {
      throw new DomainError("amount_too_large", `A single purchase can earn at most ${cfg.maxPointsPerTransaction} points. Check the amount.`, 422, {
        max: cfg.maxPointsPerTransaction
      });
    }
  }
  const reference = input.referenceId?.trim() || null;
  if (reference) {
    const dupe = await maybeOne(
      q,
      `select 1 from loyalty_transactions where business_id = $1 and programme_id = $2 and reference_id = $3 and transaction_type = 'earn'`,
      [biz.id, programme.id, reference]
    );
    if (dupe) throw new DomainError("duplicate_purchase", "This purchase reference has already earned credit.", 409);
  }
  const guard = biz.settings.duplicateGuardSeconds;
  if (guard > 0 && !input.confirmSeparatePurchase) {
    const recent = await maybeOne(
      q,
      `select created_at from loyalty_transactions
        where membership_id = $1 and programme_id = $2 and transaction_type = 'earn'
          and created_at > $3::timestamptz - make_interval(secs => $4::int) and created_at <= $3
        order by created_at desc limit 1`,
      [member.id, programme.id, now, guard]
    );
    if (recent) {
      throw new DomainError("recent_award", "This member received credit moments ago. Confirm that this is a separate purchase.", 409, {
        secondsAgo: Math.max(0, Math.round((now.getTime() - recent.created_at.getTime()) / 1e3))
      });
    }
  }
  const segCache = /* @__PURE__ */ new Map();
  const inSegment = async (seg) => {
    if (!isSegment(seg) || seg === "all") return true;
    if (!segCache.has(seg)) segCache.set(seg, await memberInSegment(q, biz.id, member.id, seg, biz.settings, now));
    return segCache.get(seg);
  };
  const bonusCampaigns = (await runningCampaigns(q, biz.id, today, ["bonus_points", "weekday", "limited_time", "custom", "win_back"])).filter(
    (c) => c.benefit?.kind === "bonus" && c.benefit?.programmeId === programme.id
  );
  const eligibleBonus = [];
  for (const c of bonusCampaigns) {
    if (withinEligibilityWindow(c, now, biz.timezone) && await inSegment(c.target_segment)) eligibleBonus.push(c);
  }
  const challenges = await many(
    q,
    `select c.*, exists (select 1 from challenge_enrolments e where e.challenge_id = c.id and e.membership_id = $3) as enrolled
       from challenges c
      where c.business_id = $1 and c.status = 'active' and c.start_date <= $2 and c.end_date >= $2`,
    [biz.id, today, member.id]
  );
  const eligibleChallenges = [];
  for (const ch of challenges) {
    if (ch.visibility === "invite_only" && !ch.enrolled) continue;
    if (!await inSegment(ch.eligible_segment)) continue;
    eligibleChallenges.push(ch);
  }
  const windowMin = biz.settings.visitWindowMinutes;
  const lastVisit = await maybeOne(
    q,
    `select id from visits where membership_id = $1
       and occurred_at > $2::timestamptz - make_interval(mins => $3::int) and occurred_at <= $2
     order by occurred_at desc limit 1`,
    [member.id, now, windowMin]
  );
  let visitId;
  let newVisit = false;
  const firstEverVisit = member.visit_count === 0;
  if (lastVisit) {
    visitId = lastVisit.id;
  } else {
    const v = await one(
      q,
      `insert into visits (business_id, membership_id, verified_by, source, reference_id, occurred_at, local_date, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $6) returning id`,
      [biz.id, member.id, input.actorUserId, input.source, reference, now, today]
    );
    visitId = v.id;
    newVisit = true;
  }
  await q.query(
    `update loyalty_memberships
        set visit_count = visit_count + $2, last_visit_at = greatest(coalesce(last_visit_at, $3), $3), updated_at = $3
      where id = $1`,
    [member.id, newVisit ? 1 : 0, now]
  );
  const balanceBefore = await lockBalance(q, biz.id, member.id, programme.id);
  let balance = await changeBalance(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    delta: credit,
    earned: credit,
    now
  });
  const unit = programme.programme_type === "stamps" ? credit === 1 ? "stamp" : "stamps" : "points";
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    programmeType: programme.programme_type,
    operationId: op.id,
    type: "earn",
    delta: credit,
    balanceAfter: balance,
    source: input.source,
    description: `+${credit} ${unit} for a qualifying purchase`,
    actorUserId: input.actorUserId,
    referenceId: reference,
    amountMinor,
    currency,
    visitId,
    now
  });
  let bonusTotal = 0;
  const bonuses = [];
  for (const c of eligibleBonus) {
    const benefit = campaignBenefitSchema.safeParse(c.benefit);
    if (!benefit.success || benefit.data.kind !== "bonus") continue;
    const usage = await campaignUsage(q, c.id, member.id, "bonus_awarded");
    if (c.usage_limit_per_customer && usage.mine >= c.usage_limit_per_customer) continue;
    if (c.total_limit && usage.total >= c.total_limit) continue;
    const amount = benefit.data.mode === "multiplier" ? credit * (benefit.data.amount - 1) : benefit.data.amount;
    if (amount <= 0) continue;
    balance = await changeBalance(q, { businessId: biz.id, membershipId: member.id, programmeId: programme.id, delta: amount, earned: amount, now });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: member.id,
      programmeId: programme.id,
      programmeType: programme.programme_type,
      operationId: op.id,
      type: "bonus",
      delta: amount,
      balanceAfter: balance,
      source: "campaign",
      description: `${c.name}: +${amount} ${programme.programme_type === "stamps" ? amount === 1 ? "stamp" : "stamps" : "points"}`,
      actorUserId: input.actorUserId,
      campaignId: c.id,
      visitId,
      now
    });
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: c.id,
      membershipId: member.id,
      customerId: member.customer_id,
      type: "bonus_awarded",
      dedupeKey: op.id,
      operationId: op.id,
      data: { amount },
      now
    });
    bonusTotal += amount;
    bonuses.push({ campaignName: c.name, amount });
  }
  const vouchersIssued = [];
  if (programme.programme_type === "stamps") {
    const done = await completeStampCards(
      q,
      { biz, membershipId: member.id, programme, operationId: op.id, actorUserId: input.actorUserId, source: input.source, now },
      notices
    );
    vouchersIssued.push(...done.vouchers);
    balance = done.balance;
  }
  const challengeCompletions = [];
  if (newVisit) {
    for (const ch of eligibleChallenges) {
      let ps = ch.start_date;
      let pe = ch.end_date;
      let key = "all";
      if (ch.period === "week") {
        const [ws, we] = weekRange(today);
        ps = maxDate(ws, ch.start_date);
        pe = minDate(we, ch.end_date);
        key = isoWeekKey(today);
      } else if (ch.period === "month") {
        const [ms, me] = monthRange(today);
        ps = maxDate(ms, ch.start_date);
        pe = minDate(me, ch.end_date);
        key = today.slice(0, 7);
      }
      const prog = await one(
        q,
        ch.rule_type === "distinct_days" ? "select count(distinct local_date) as n from visits where membership_id = $1 and local_date between $2 and $3" : "select count(*) as n from visits where membership_id = $1 and local_date between $2 and $3",
        [member.id, ps, pe]
      );
      if (prog.n < ch.required_count) continue;
      const done = await one(
        q,
        `select count(*) as total, count(*) filter (where period_key = $3) as this_period
           from challenge_completions where challenge_id = $1 and membership_id = $2`,
        [ch.id, member.id, key]
      );
      if (done.this_period > 0 || done.total >= ch.max_completions_per_customer) continue;
      const ins = await q.query(
        `insert into challenge_completions (business_id, challenge_id, membership_id, period_key, operation_id, completed_at)
         values ($1,$2,$3,$4,$5,$6) on conflict do nothing returning id`,
        [biz.id, ch.id, member.id, key, op.id, now]
      );
      if (!ins.rows[0]) continue;
      const grant = ch.reward_kind === "voucher" ? { kind: "voucher", rewardId: ch.reward_id } : { kind: "bonus", programmeId: ch.bonus_programme_id, amount: ch.bonus_amount };
      const outcome = await applyGrant(
        q,
        {
          biz,
          membershipId: member.id,
          grant,
          operationId: op.id,
          actorUserId: input.actorUserId,
          now,
          voucherSource: "challenge",
          txnType: "challenge",
          txnSource: "challenge",
          description: `Challenge complete \u2014 ${ch.name}`,
          challengeId: ch.id,
          sourceRefId: ch.id
        },
        notices
      );
      if (outcome?.voucher) {
        vouchersIssued.push(outcome.voucher);
        await q.query("update challenge_completions set customer_reward_id = $2 where id = $1", [ins.rows[0].id, outcome.voucher.id]);
      }
      if (outcome?.vouchers) vouchersIssued.push(...outcome.vouchers);
      if (outcome?.kind === "bonus" && outcome.programmeId === programme.id) {
        balance = await lockBalance(q, biz.id, member.id, programme.id);
      }
      challengeCompletions.push({ challengeId: ch.id, challengeName: ch.name, outcome: outcome?.description ?? "Completed" });
    }
  }
  let referralQualified = false;
  if (newVisit && firstEverVisit) {
    referralQualified = await qualifyReferral(q, { biz, member, operationId: op.id, actorUserId: input.actorUserId, now, today }, notices);
    if (referralQualified) balance = await lockBalance(q, biz.id, member.id, programme.id);
  }
  const result = {
    operationId: op.id,
    duplicate: false,
    membershipId: member.id,
    programmeId: programme.id,
    programmeName: programme.name,
    programmeType: programme.programme_type,
    credited: credit,
    bonus: bonusTotal,
    balanceBefore,
    balanceAfter: balance,
    newVisit,
    visitId,
    vouchersIssued,
    bonuses,
    challengeCompletions,
    referralQualified,
    notices
  };
  await finishOperation(q, op.id, result);
  return result;
}
async function qualifyReferral(q, a, notices) {
  const ref = await maybeOne(
    q,
    `select * from referrals where business_id = $1 and referred_membership_id = $2 and status = 'pending' for update`,
    [a.biz.id, a.member.id]
  );
  if (!ref) return false;
  const reject = async (reason) => {
    await q.query(`update referrals set status = 'rejected', rejection_reason = $2 where id = $1`, [ref.id, reason]);
    notices.push(`referral_rejected:${reason}`);
    return false;
  };
  const campaigns = await runningCampaigns(q, a.biz.id, a.today, ["referral"]);
  const campaign = campaigns.find((c) => c.id === ref.campaign_id) ?? campaigns[0];
  if (!campaign) return reject("no_active_referral_campaign");
  const cfg = referralConfigSchema.safeParse(campaign.config);
  if (!cfg.success) return reject("referral_campaign_misconfigured");
  const referrer = await maybeOne(
    q,
    "select id, status, customer_id from loyalty_memberships where id = $1 and business_id = $2",
    [ref.referrer_membership_id, a.biz.id]
  );
  if (!referrer || referrer.status !== "active") return reject("referrer_inactive");
  if (referrer.customer_id === a.member.customer_id) return reject("self_referral");
  await q.query("select pg_advisory_xact_lock(hashtext($1))", ["referrer:" + referrer.id]);
  const count = await one(
    q,
    `select count(*) as n from referrals where referrer_membership_id = $1 and status = 'qualified'`,
    [referrer.id]
  );
  if (count.n >= cfg.data.maxPerReferrer) return reject("referrer_limit");
  const common = {
    biz: a.biz,
    operationId: a.operationId,
    actorUserId: a.actorUserId,
    now: a.now,
    voucherSource: "referral",
    txnType: "referral",
    txnSource: "referral",
    campaignId: campaign.id,
    sourceRefId: ref.id,
    extraEndDates: []
  };
  await applyGrant(q, { ...common, membershipId: a.member.id, grant: cfg.data.referredGrant, description: "Welcome referral reward" }, notices);
  await applyGrant(q, { ...common, membershipId: referrer.id, grant: cfg.data.referrerGrant, description: "Referral reward" }, notices);
  await q.query(
    `update referrals set status = 'qualified', qualified_at = $2, qualifying_operation_id = $3, campaign_id = $4 where id = $1`,
    [ref.id, a.now, a.operationId, campaign.id]
  );
  await recordCampaignEvent(q, {
    businessId: a.biz.id,
    campaignId: campaign.id,
    membershipId: referrer.id,
    customerId: referrer.customer_id,
    type: "referral_qualified",
    dedupeKey: ref.id,
    operationId: a.operationId,
    now: a.now
  });
  return true;
}
async function newRedemptionCode(q) {
  for (let i = 0; i < 5; i++) {
    const code = randomCode(8);
    const ex = await maybeOne(q, "select 1 from reward_redemptions where redemption_code = $1", [code]);
    if (!ex) return code;
  }
  throw new Error("Could not allocate a redemption code");
}
async function redeemVoucher(q, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const voucherRef = await maybeOne(
    q,
    "select membership_id from customer_rewards where id = $1 and business_id = $2",
    [input.customerRewardId, biz.id]
  );
  if (!voucherRef) throw notFound("Reward");
  if (input.membershipId && voucherRef.membership_id !== input.membershipId) throw notFound("Reward");
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: voucherRef.membership_id,
    kind: "redeem_voucher",
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now
  });
  if (op.duplicate) return { ...op.result, duplicate: true };
  const member = await lockMembership(q, biz.id, voucherRef.membership_id);
  const v = await one(
    q,
    `select cr.*, r.name as reward_name, r.programme_id as reward_programme_id
       from customer_rewards cr join rewards r on r.id = cr.reward_id
      where cr.id = $1 and cr.business_id = $2 for no key update of cr`,
    [input.customerRewardId, biz.id]
  );
  if (v.status === "redeemed") throw new DomainError("already_redeemed", "This reward has already been redeemed.", 409);
  if (v.status === "void") throw new DomainError("voucher_void", "This reward was cancelled and cannot be redeemed.", 409);
  if (v.status === "expired" || v.expires_at && v.expires_at.getTime() <= now.getTime()) {
    throw new DomainError("reward_expired", "This reward has expired.", 409);
  }
  const code = await newRedemptionCode(q);
  const red = await one(
    q,
    `insert into reward_redemptions (business_id, membership_id, reward_id, customer_reward_id, programme_id, status,
        redemption_code, operation_id, redeemed_by, redeemed_at, created_at)
     values ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$9) returning id`,
    [biz.id, member.id, v.reward_id, v.id, v.reward_programme_id, code, op.id, input.actorUserId, now]
  );
  await q.query(`update customer_rewards set status = 'redeemed', redeemed_at = $2 where id = $1`, [v.id, now]);
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: v.reward_programme_id,
    programmeType: null,
    operationId: op.id,
    type: "redeem",
    delta: 0,
    balanceAfter: null,
    source: input.source ?? "terminal",
    description: `Redeemed: ${v.reward_name}`,
    actorUserId: input.actorUserId,
    customerRewardId: v.id,
    redemptionId: red.id,
    now
  });
  if (v.source === "campaign" && v.source_ref_id) {
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: v.source_ref_id,
      membershipId: member.id,
      customerId: member.customer_id,
      type: "redeemed",
      dedupeKey: v.id,
      operationId: op.id,
      now
    }).catch(() => void 0);
  }
  const result = {
    operationId: op.id,
    duplicate: false,
    redemptionId: red.id,
    redemptionCode: code,
    rewardName: v.reward_name,
    membershipId: member.id,
    pointsSpent: 0,
    balanceAfter: null
  };
  await finishOperation(q, op.id, result);
  return result;
}
async function redeemPoints(q, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: input.membershipId,
    kind: "redeem_points",
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now
  });
  if (op.duplicate) return { ...op.result, duplicate: true };
  const member = await lockMembership(q, biz.id, input.membershipId);
  const reward = await loadReward(q, biz.id, input.rewardId);
  if (!reward.points_cost || !reward.programme_id) {
    throw new DomainError("reward_unavailable", "This reward is not available for points.", 409);
  }
  const programme = await loadProgramme(q, biz.id, reward.programme_id);
  const today = localDate(now, biz.timezone);
  assertProgrammeRunning(programme, today);
  const blocker = await rewardBlocker(q, reward, member.id, today);
  if (blocker === "reward_not_started") throw new DomainError("reward_not_started", "This reward is not available yet.", 409);
  if (blocker === "reward_expired") throw new DomainError("reward_expired", "This reward is no longer available.", 409);
  if (blocker === "limit_reached") throw new DomainError("limit_reached", "The redemption limit for this reward has been reached.", 409);
  if (blocker) throw new DomainError("reward_unavailable", "This reward is not active.", 409);
  const balance = await lockBalance(q, biz.id, member.id, programme.id);
  if (balance < reward.points_cost) {
    throw new DomainError("insufficient_balance", `Needs ${reward.points_cost} points; the member has ${balance}.`, 409, {
      required: reward.points_cost,
      balance
    });
  }
  const voucher = await one(
    q,
    `insert into customer_rewards (business_id, membership_id, reward_id, source, operation_id, status, issued_at, redeemed_at, created_at)
     values ($1,$2,$3,'points',$4,'redeemed',$5,$5,$5) returning id`,
    [biz.id, member.id, reward.id, op.id, now]
  );
  const code = await newRedemptionCode(q);
  const red = await one(
    q,
    `insert into reward_redemptions (business_id, membership_id, reward_id, customer_reward_id, programme_id, points_spent, status,
        redemption_code, operation_id, redeemed_by, redeemed_at, created_at)
     values ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10,$10) returning id`,
    [biz.id, member.id, reward.id, voucher.id, programme.id, reward.points_cost, code, op.id, input.actorUserId, now]
  );
  const after = await changeBalance(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    delta: -reward.points_cost,
    spent: reward.points_cost,
    now
  });
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    programmeType: "points",
    operationId: op.id,
    type: "redeem",
    delta: -reward.points_cost,
    balanceAfter: after,
    source: input.source ?? "terminal",
    description: `Redeemed: ${reward.name}`,
    actorUserId: input.actorUserId,
    customerRewardId: voucher.id,
    redemptionId: red.id,
    now
  });
  const result = {
    operationId: op.id,
    duplicate: false,
    redemptionId: red.id,
    redemptionCode: code,
    rewardName: reward.name,
    membershipId: member.id,
    pointsSpent: reward.points_cost,
    balanceAfter: after
  };
  await finishOperation(q, op.id, result);
  return result;
}
async function allocateCodes(q) {
  for (let i = 0; i < 8; i++) {
    const memberCode = randomCode(8);
    const referralCode = randomCode(7);
    const clash = await maybeOne(q, "select 1 from loyalty_memberships where member_code = $1 or referral_code = $2", [memberCode, referralCode]);
    if (!clash) return { memberCode, referralCode };
  }
  throw new Error("Could not allocate a member code");
}
async function joinBusiness(q, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const today = localDate(now, biz.timezone);
  await q.query("select pg_advisory_xact_lock(hashtext($1))", ["join:" + biz.id + ":" + input.customerId]);
  const existing = await maybeOne(
    q,
    "select id, member_code from loyalty_memberships where business_id = $1 and customer_id = $2",
    [biz.id, input.customerId]
  );
  if (existing) return { membershipId: existing.id, memberCode: existing.member_code, alreadyMember: true, welcome: [], referral: "none" };
  let referrer = null;
  let referral = "none";
  const code = input.referralCode?.trim().toUpperCase();
  if (code) {
    referrer = await maybeOne(
      q,
      `select id, customer_id from loyalty_memberships where business_id = $1 and referral_code = $2 and status = 'active'`,
      [biz.id, code]
    );
    if (!referrer) referral = "invalid";
    else if (referrer.customer_id === input.customerId) {
      referral = "self";
      referrer = null;
    }
  }
  const { memberCode, referralCode } = await allocateCodes(q);
  const m = await one(
    q,
    `insert into loyalty_memberships (business_id, customer_id, member_code, referral_code, status, source, marketing_consent,
        consent_updated_at, referred_by_membership_id, joined_at, created_at, updated_at)
     values ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$9,$9) returning id`,
    [biz.id, input.customerId, memberCode, referralCode, input.source, input.marketingConsent, input.marketingConsent ? now : null, referrer?.id ?? null, now]
  );
  await q.query(
    `insert into membership_balances (membership_id, programme_id, business_id, updated_at)
     select $1, id, business_id, $3 from loyalty_programmes where business_id = $2 and status = 'active'
     on conflict do nothing`,
    [m.id, biz.id, now]
  );
  if (referrer) {
    const refCampaign = (await runningCampaigns(q, biz.id, today, ["referral"]))[0];
    await q.query(
      `insert into referrals (business_id, campaign_id, referrer_membership_id, referred_membership_id, referral_code, status, created_at)
       values ($1, $2, $3, $4, $5, 'pending', $6)`,
      [biz.id, refCampaign?.id ?? null, referrer.id, m.id, code, now]
    );
    referral = "pending";
  }
  const welcome = [];
  const notices = [];
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: m.id,
    kind: "join",
    key: "join:" + m.id,
    actorUserId: input.actorUserId ?? null,
    now
  });
  for (const c of await runningCampaigns(q, biz.id, today, ["welcome"])) {
    const benefit = campaignBenefitSchema.safeParse(c.benefit);
    if (!benefit.success || benefit.data.kind === "none") continue;
    const usage = await campaignUsage(q, c.id, m.id, benefit.data.kind === "voucher" ? "voucher_issued" : "bonus_awarded");
    if (c.total_limit && usage.total >= c.total_limit) continue;
    const grant = benefit.data.kind === "voucher" ? { kind: "voucher", rewardId: benefit.data.rewardId } : { kind: "bonus", programmeId: benefit.data.programmeId, amount: benefit.data.amount };
    const outcome = await applyGrant(
      q,
      {
        biz,
        membershipId: m.id,
        grant,
        operationId: op.id,
        actorUserId: input.actorUserId ?? null,
        now,
        voucherSource: "campaign",
        txnType: "welcome",
        txnSource: "campaign",
        description: c.name,
        campaignId: c.id,
        sourceRefId: c.id,
        extraEndDates: [c.end_date]
      },
      notices
    );
    if (outcome) {
      welcome.push(outcome);
      await recordCampaignEvent(q, {
        businessId: biz.id,
        campaignId: c.id,
        membershipId: m.id,
        customerId: input.customerId,
        type: outcome.kind === "voucher" ? "voucher_issued" : "bonus_awarded",
        dedupeKey: "welcome",
        operationId: op.id,
        now
      });
    }
  }
  const result = { membershipId: m.id, memberCode, alreadyMember: false, welcome, referral };
  await finishOperation(q, op.id, result);
  return result;
}
async function distributeCampaignVouchers(q, input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const today = localDate(now, biz.timezone);
  const c = await maybeOne(q, `select ${CAMPAIGN_COLS} from campaigns where id = $1 and business_id = $2`, [input.campaignId, biz.id]);
  if (!c) throw notFound("Campaign");
  if (c.status !== "published" || c.start_date > today || c.end_date && c.end_date < today) {
    throw new DomainError("conflict", "Only a running campaign can issue rewards.", 409);
  }
  const benefit = campaignBenefitSchema.safeParse(c.benefit);
  if (!benefit.success || benefit.data.kind !== "voucher") return { issued: 0 };
  const reward = await loadReward(q, biz.id, benefit.data.rewardId);
  const { params, p } = paramBuilder([biz.id]);
  const seg = isSegment(c.target_segment) ? c.target_segment : "all";
  const pred = segmentPredicate(seg, biz.settings, now, p);
  const members = await many(
    q,
    `select m.id, m.customer_id from loyalty_memberships m where m.business_id = $1 and m.status = 'active' and ${pred} order by m.joined_at`,
    params
  );
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: null,
    kind: "campaign_issue",
    key: `campaign:${c.id}:${now.getTime()}`,
    actorUserId: input.actorUserId,
    now
  });
  let issued = 0;
  const notices = [];
  for (const m of members) {
    const usage = await campaignUsage(q, c.id, m.id, "voucher_issued");
    if (usage.mine >= (c.usage_limit_per_customer ?? 1)) continue;
    if (c.total_limit && usage.total >= c.total_limit) break;
    const blocker = await rewardBlocker(q, reward, m.id, today);
    if (blocker) {
      if (blocker === "limit_reached") continue;
      notices.push(blocker);
      break;
    }
    const voucher = await issueVoucher(q, {
      biz,
      membershipId: m.id,
      reward,
      source: "campaign",
      sourceRefId: c.id,
      operationId: op.id,
      now,
      extraEndDates: [c.end_date]
    });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: m.id,
      programmeId: reward.programme_id,
      programmeType: null,
      operationId: op.id,
      type: "voucher_issued",
      delta: 0,
      balanceAfter: null,
      source: "campaign",
      description: `${c.name}: ${reward.name}`,
      actorUserId: input.actorUserId,
      campaignId: c.id,
      customerRewardId: voucher.id,
      now
    });
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: c.id,
      membershipId: m.id,
      customerId: m.customer_id,
      type: "voucher_issued",
      dedupeKey: `issue:${usage.mine + 1}`,
      operationId: op.id,
      now
    });
    issued++;
  }
  await finishOperation(q, op.id, { issued, notices });
  return { issued, notices, eligible: members.length };
}
var CAMPAIGN_COLS;
var init_loyalty = __esm({
  "src/server/domain/loyalty.ts"() {
    "use strict";
    init_db();
    init_errors2();
    init_crypto();
    init_schemas();
    init_time();
    init_segments();
    CAMPAIGN_COLS = `id, name, campaign_type, status, start_date, end_date, target_segment, benefit, eligibility, config,
  usage_limit_per_customer, total_limit`;
  }
});

// src/server/seed/demo.ts
var demo_exports = {};
__export(demo_exports, {
  DEMO_SLUG: () => DEMO_SLUG,
  resetDemoData: () => resetDemoData,
  seedDemo: () => seedDemo
});
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function zoned(dateStr, hour, minute, tz = TZ) {
  const [y, m, d] = dateStr.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, hour, minute) - 2 * 3600 * 1e3;
  for (let i = 0; i < 3; i++) {
    const lp = localParts(new Date(guess), tz);
    const diffMin = lp.hour * 60 + lp.minute - (hour * 60 + minute) + (lp.date === dateStr ? 0 : lp.date > dateStr ? 1440 : -1440);
    if (diffMin === 0) break;
    guess -= diffMin * 6e4;
  }
  return new Date(guess);
}
async function seedDemo() {
  if (!config().DEMO_MODE) {
    console.log("DEMO_MODE=false \u2014 skipping demo data");
    return;
  }
  await seedPlans();
  const existing = await maybeOne(db, "select 1 from businesses where slug = $1", [DEMO_SLUG]);
  if (existing) {
    console.log("demo caf\xE9 already exists (use demo-reset to rebuild it)");
    return;
  }
  const t0 = Date.now();
  const password = config().DEMO_PASSWORD ?? "perkora-demo-2026";
  const now = /* @__PURE__ */ new Date();
  const today = localDate(now, TZ);
  const rand = mulberry32(20261027);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const userId = async (name, email) => {
    const ex = await maybeOne(db, "select id from users where lower(email) = $1", [email]);
    if (ex) return ex.id;
    return (await tx((q) => createUser(q, { name, email, password, isDemo: true }))).id;
  };
  const ownerId = await userId("Aylin Kaya", "owner@demo.perkora.app");
  const staffId = await userId("Emre Y\u0131ld\u0131z", "staff@demo.perkora.app");
  const bakeryOwnerId = await userId("Sophie Ward", "bakery@demo.perkora.app");
  const mayaUserId = await userId("Maya Collins", "maya.collins@example.com");
  const biz = await one(
    db,
    `insert into businesses (name, slug, owner_user_id, owner_name, business_email, city, address, description, primary_colour, secondary_colour, timezone, default_currency,
        status, onboarding_step, is_demo, activated_at, settings, created_at)
     values ('Perkora Demo Caf\xE9', $1, $2, 'Aylin Kaya', 'hello@demo.perkora.app', 'Girne', 'Harbour Road (fictional address)',
        'A contemporary independent caf\xE9 serving specialty coffee and everyday favourites.', '#3B2925', '#B86F52', $3, 'EUR',
        'active', 6, true, $4, $5, $4) returning id`,
    [
      DEMO_SLUG,
      ownerId,
      TZ,
      new Date(now.getTime() - 130 * 864e5),
      {
        inactivityDays: 21,
        staffInstructions: "Demo: one stamp per coffee drink (up to 2 per order). Ask for the receipt number on orders over \u20AC20."
      }
    ]
  );
  const B = biz.id;
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [B, ownerId]);
  await db.query(`insert into business_members (business_id, user_id, role, permissions, invited_by) values ($1, $2, 'staff', $3, $4)`, [B, staffId, { view_customers: true }, ownerId]);
  await db.query(`insert into subscriptions (business_id, plan_id, status, payment_status, provider, notes) values ($1, 'premium', 'demo', 'not_configured', 'manual', 'Demonstration account')`, [B]);
  const start = addDays(today, -130);
  const stamps = await one(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config, terms, created_at) values ($1, 'Coffee Club', 'stamps', $2, $3, $4) returning id`,
    [
      B,
      { stampsRequired: 9, eligiblePurchase: "Any handcrafted coffee drink", maxStampsPerTransaction: 2, allowWithOtherPromotions: false },
      "Demonstration settings. One stamp per coffee drink, up to two per order. Rewards have no cash value.",
      new Date(now.getTime() - 130 * 864e5)
    ]
  );
  const points = await one(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config, terms, created_at) values ($1, 'Coffee Points', 'points', $2, $3, $4) returning id`,
    [
      B,
      { earnMode: "per_currency_unit", pointsPerUnit: 1, pointsPerPurchase: 10, minSpendMinor: 0, maxPointsPerTransaction: 300, eligiblePurchase: "Food and retail purchases", allowWithOtherPromotions: true },
      "Demonstration settings. 1 point per \u20AC1 on food and retail.",
      new Date(now.getTime() - 130 * 864e5)
    ]
  );
  const reward = async (cols) => {
    const keys = Object.keys(cols);
    const r = await one(db, `insert into rewards (business_id, ${keys.join(", ")}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [B, ...Object.values(cols)]);
    return r.id;
  };
  await reward({ programme_id: stamps.id, name: "Free Regular Coffee", description: "Any regular-size hot or iced coffee", reward_type: "free_item", icon: "coffee", stamps_cost: 9, is_card_reward: true, validity_days: 30 });
  const upgradeId = await reward({ programme_id: points.id, name: "Free Coffee Upgrade", description: "Upgrade any drink to large, or add an extra shot", reward_type: "free_upgrade", icon: "cup", points_cost: 30, terms: "Demonstration reward." });
  const pastryPtsId = await reward({ programme_id: points.id, name: "Pastry of Your Choice", description: "Any pastry from the counter", reward_type: "free_item", icon: "croissant", points_cost: 45 });
  const freePastryId = await reward({ name: "Free Pastry", description: "Any pastry from the counter", reward_type: "free_item", icon: "croissant", validity_days: 14 });
  const cakeId = await reward({ name: "Birthday Cake Slice", description: "A slice of today\u2019s cake", reward_type: "free_item", icon: "cake", validity_days: 14 });
  await reward({ name: "Half-price Iced Latte", description: "50% off any iced latte", reward_type: "discount", icon: "percent", validity_days: 7, status: "inactive" });
  const camp = async (cols) => {
    cols = { created_at: cols.published_at ?? new Date(now.getTime() - 2 * 864e5), ...cols };
    const keys = Object.keys(cols);
    return (await one(db, `insert into campaigns (business_id, ${keys.join(", ")}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [B, ...Object.values(cols)])).id;
  };
  await camp({
    name: "Welcome stamp",
    description: "Join the Coffee Club and your first stamp is on us.",
    campaign_type: "welcome",
    status: "published",
    start_date: start,
    benefit: { kind: "bonus", programmeId: stamps.id, mode: "flat", amount: 1 },
    redemption_instructions: "Added automatically when you join.",
    is_public: true,
    published_at: new Date(now.getTime() - 130 * 864e5)
  });
  await camp({
    name: "Afternoon Coffee Offer",
    description: "Double stamps on weekday afternoons (demonstration setting).",
    campaign_type: "weekday",
    status: "published",
    start_date: addDays(today, -45),
    end_date: addDays(today, 30),
    benefit: { kind: "bonus", programmeId: stamps.id, mode: "multiplier", amount: 2 },
    eligibility: { weekdays: [1, 2, 3, 4, 5], startTime: "14:00", endTime: "17:00" },
    redemption_instructions: "Show your card for any coffee between 14:00 and 17:00, Monday to Friday.",
    is_public: true,
    published_at: new Date(now.getTime() - 45 * 864e5)
  });
  const referralId = await camp({
    name: "Bring a Friend",
    description: "Invite a friend. After their first visit you get 2 stamps and they get a free pastry.",
    campaign_type: "referral",
    status: "published",
    start_date: addDays(today, -90),
    config: { referrerGrant: { kind: "bonus", programmeId: stamps.id, amount: 2 }, referredGrant: { kind: "voucher", rewardId: freePastryId }, maxPerReferrer: 5 },
    is_public: false,
    published_at: new Date(now.getTime() - 90 * 864e5)
  });
  await camp({
    name: "Birthday treat",
    description: "A slice of cake on us around your birthday.",
    campaign_type: "birthday",
    status: "published",
    start_date: start,
    benefit: { kind: "voucher", rewardId: cakeId },
    config: { windowDays: 7 },
    redemption_instructions: "Appears in your card in your birthday week.",
    is_public: true,
    published_at: new Date(now.getTime() - 130 * 864e5)
  });
  await camp({
    name: "Summer Iced Latte Week",
    description: "Draft for next summer: half-price iced lattes for members.",
    campaign_type: "limited_time",
    status: "draft",
    start_date: addDays(today, 200),
    end_date: addDays(today, 207),
    benefit: { kind: "none" }
  });
  await db.query(
    `insert into challenges (business_id, name, description, rule_type, required_count, period, start_date, end_date, reward_kind, bonus_programme_id, bonus_amount, max_completions_per_customer, status)
     values ($1, 'Three-day week', 'Visit on three different days in a week and get 2 bonus stamps.', 'distinct_days', 3, 'week', $2, $3, 'bonus', $4, 2, 12, 'active')`,
    [B, addDays(today, -60), addDays(today, 60), stamps.id]
  );
  const personas = [
    // 1 welcome stamp + 15 single-stamp morning visits = 16 stamps: one full card (redeemed) and 7 of 9
    { name: "Maya Collins", email: "maya.collins@example.com", pattern: "weekly", joinedDaysAgo: 66, points: true, marketing: true, fixed: "maya", schedule: [64, 60, 56, 52, 48, 44, 40, 36, 32, 28, 24, 20, 14, 8, 2] },
    { name: "Deniz Arslan", email: "deniz.arslan@example.com", pattern: "regular", joinedDaysAgo: 125, points: true, marketing: true, birthday: [11, 2], fixed: "deniz" },
    // 1 welcome stamp + 10 visits = 11: one unused reward (unlocked ~13 days ago) and 2 stamps
    { name: "Andreas Georgiou", email: "andreas.georgiou@example.com", pattern: "weekly", joinedDaysAgo: 62, points: false, marketing: false, fixed: "andreas", schedule: [61, 55, 49, 43, 37, 31, 25, 13, 7, 1] },
    { name: "Hannah Wright", email: "hannah.wright@example.com", pattern: "lapsed", joinedDaysAgo: 110, points: true, marketing: true, fixed: "hannah" },
    { name: "Leyla \xD6zkan", email: "leyla.ozkan@example.com", pattern: "new", joinedDaysAgo: 2, points: false, marketing: false, fixed: "leyla" }
  ];
  const used = new Set(personas.map((p) => p.name));
  const patterns = ["regular", "regular", "weekly", "weekly", "weekly", "occasional", "occasional", "occasional", "lapsed", "lapsed", "new", "joined_only"];
  while (personas.length < 72) {
    const pool2 = POOLS[rand() < 0.55 ? 0 : rand() < 0.5 ? 1 : 2];
    const name = `${pick(pool2[0])} ${pick(pool2[1])}`;
    if (used.has(name)) continue;
    used.add(name);
    const pattern = pick(patterns);
    const joinedDaysAgo = pattern === "new" || pattern === "joined_only" ? 1 + Math.floor(rand() * 14) : 20 + Math.floor(rand() * 105);
    const slug = name.toLowerCase().replace(/ş/g, "s").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/i̇/g, "i").replace(/[^a-z]+/g, ".");
    personas.push({
      name,
      email: rand() < 0.85 ? `${slug}${personas.length}@example.com` : void 0,
      pattern,
      joinedDaysAgo,
      points: rand() < 0.45,
      marketing: rand() < 0.55,
      birthday: rand() < 0.3 ? [1 + Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)] : void 0,
      referrer: rand() < 0.12 ? "Deniz Arslan" : void 0
    });
  }
  const events = [];
  for (const p of personas) {
    const joinDate = addDays(today, -p.joinedDaysAgo);
    const joinAt = zoned(joinDate, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    events.push({ at: joinAt, kind: "join", p });
    let lastVisitDaysAgo = 0;
    let gapMean = 3;
    switch (p.pattern) {
      case "regular":
        gapMean = 3.2;
        break;
      case "weekly":
        gapMean = 6;
        break;
      case "occasional":
        gapMean = 12;
        break;
      case "lapsed":
        gapMean = 5;
        lastVisitDaysAgo = 25 + Math.floor(rand() * 30);
        break;
      case "new":
        gapMean = 3;
        break;
      case "joined_only":
        continue;
    }
    if (p.fixed === "hannah") lastVisitDaysAgo = 38;
    if (p.schedule) {
      for (const daysAgo of p.schedule) {
        events.push({ at: zoned(addDays(today, -daysAgo), 9, 15), kind: "visit", p, qty: 1, amount: p.points ? 420 + daysAgo * 7 : void 0, redeem: true });
      }
      continue;
    }
    let d = p.joinedDaysAgo;
    let first = true;
    while (d >= lastVisitDaysAgo) {
      const date = addDays(today, -d);
      const afternoon = rand() < 0.35;
      const hour = afternoon ? 14 + Math.floor(rand() * 3) : 8 + Math.floor(rand() * 5);
      let at = zoned(date, hour, Math.floor(rand() * 60));
      if (first && at.getTime() <= joinAt.getTime()) at = new Date(joinAt.getTime() + 5 * 6e4);
      if (at.getTime() < now.getTime() - 60 * 6e4) {
        events.push({ at, kind: "visit", p, qty: rand() < 0.2 ? 2 : 1, amount: p.points && rand() < 0.6 ? 350 + Math.floor(rand() * 1400) : void 0, redeem: true });
      }
      first = false;
      d -= Math.max(1, Math.round(gapMean * (0.5 + rand())));
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  const memberships = /* @__PURE__ */ new Map();
  const customerIds = /* @__PURE__ */ new Map();
  for (const ev of events) {
    const p = ev.p;
    if (ev.kind === "join") {
      const customerId = await tx(async (q) => {
        const c = await one(
          q,
          `insert into customers (name, email, birthday_month, birthday_day, is_demo, user_id, created_at) values ($1, $2, $3, $4, true, $5, $6) returning id`,
          [p.name, p.email ?? null, p.birthday?.[0] ?? null, p.birthday?.[1] ?? null, p.fixed === "maya" ? mayaUserId : null, ev.at]
        );
        return c.id;
      });
      customerIds.set(p.name, customerId);
      const refCode = p.referrer && memberships.has(p.referrer) ? (await one(db, "select referral_code from loyalty_memberships where id = $1", [memberships.get(p.referrer)])).referral_code : null;
      const j = await tx((q) => joinBusiness(q, { businessId: B, customerId, source: refCode ? "referral" : "demo", marketingConsent: p.marketing, referralCode: refCode, now: ev.at }));
      memberships.set(p.name, j.membershipId);
      continue;
    }
    const m = memberships.get(p.name);
    if (!m) continue;
    const staff = rand() < 0.7 ? staffId : ownerId;
    if (ev.redeem && p.fixed !== "andreas" && (p.fixed === "maya" || rand() < 0.5)) {
      const v = await maybeOne(
        db,
        `select id from customer_rewards where membership_id = $1 and status = 'available' and (expires_at is null or expires_at > $2) and issued_at < $2 order by issued_at limit 1`,
        [m, ev.at]
      );
      if (v) await tx((q) => redeemVoucher(q, { businessId: B, customerRewardId: v.id, actorUserId: staff, idempotencyKey: import_node_crypto4.default.randomUUID(), now: new Date(ev.at.getTime() - 6e4), source: "seed" }));
    }
    await tx(
      (q) => awardPurchase(q, { businessId: B, membershipId: m, programmeId: stamps.id, actorUserId: staff, idempotencyKey: import_node_crypto4.default.randomUUID(), quantity: ev.qty, source: "seed", confirmSeparatePurchase: true, now: ev.at })
    );
    if (ev.amount) {
      await tx(
        (q) => awardPurchase(q, {
          businessId: B,
          membershipId: m,
          programmeId: points.id,
          actorUserId: staff,
          idempotencyKey: import_node_crypto4.default.randomUUID(),
          amountMinor: ev.amount,
          currency: "EUR",
          source: "seed",
          confirmSeparatePurchase: true,
          now: new Date(ev.at.getTime() + 2e4)
        })
      );
      const bal = await one(db, "select balance from membership_balances where membership_id = $1 and programme_id = $2", [m, points.id]);
      if (bal.balance >= 45 && rand() < 0.35 && p.fixed !== "maya") {
        await tx(
          (q) => redeemPoints(q, { businessId: B, membershipId: m, rewardId: rand() < 0.6 ? upgradeId : pastryPtsId, actorUserId: staff, idempotencyKey: import_node_crypto4.default.randomUUID(), now: new Date(ev.at.getTime() + 4e4), source: "seed" })
        );
      }
    }
  }
  const winBackId = await camp({
    name: "We miss you",
    description: "Haven\u2019t seen you in a while \u2014 here\u2019s a free pastry with your next coffee.",
    campaign_type: "win_back",
    status: "published",
    start_date: addDays(today, -3),
    end_date: addDays(today, 25),
    target_segment: "inactive",
    benefit: { kind: "voucher", rewardId: freePastryId },
    usage_limit_per_customer: 1,
    redemption_instructions: "Show your card at the counter.",
    is_public: false,
    published_at: new Date(now.getTime() - 3 * 864e5)
  });
  await tx((q) => distributeCampaignVouchers(q, { businessId: B, campaignId: winBackId, actorUserId: ownerId, now: new Date(now.getTime() - 3 * 864e5 + 36e5) }));
  for (const name of ["Deniz Arslan", "Maya Collins", "Hannah Wright"]) {
    const m = memberships.get(name);
    if (m) await db.query(`insert into campaign_events (business_id, campaign_id, membership_id, event_type, dedupe_key) values ($1, $2, $3, 'viewed', $4) on conflict do nothing`, [B, winBackId, m, today]);
  }
  const bakery = await one(
    db,
    `insert into businesses (name, slug, owner_user_id, owner_name, city, description, primary_colour, secondary_colour, timezone, default_currency, status, onboarding_step, is_demo, activated_at)
     values ('Lemon Tree Bakery', 'lemon-tree-bakery-demo', $1, 'Sophie Ward', 'Lefko\u015Fa', 'A fictional neighbourhood bakery used to show multi-caf\xE9 wallets.', '#5C6851', '#C18A35', $2, 'TRY', 'active', 6, true, now() - interval '60 days')
     returning id`,
    [bakeryOwnerId, TZ]
  );
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [bakery.id, bakeryOwnerId]);
  await db.query(`insert into subscriptions (business_id, plan_id, status, payment_status, notes) values ($1, 'starter', 'demo', 'not_configured', 'Demonstration account')`, [bakery.id]);
  const bStamps = await one(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Bread Card', 'stamps', $2) returning id`,
    [bakery.id, { stampsRequired: 6, eligiblePurchase: "Any loaf of bread", maxStampsPerTransaction: 1, allowWithOtherPromotions: false }]
  );
  await db.query(`insert into rewards (business_id, programme_id, name, reward_type, icon, stamps_cost, is_card_reward, validity_days) values ($1, $2, 'Free Sourdough Loaf', 'free_item', 'gift', 6, true, 21)`, [bakery.id, bStamps.id]);
  const mayaCustomer = customerIds.get("Maya Collins");
  const bm = await tx((q) => joinBusiness(q, { businessId: bakery.id, customerId: mayaCustomer, source: "demo", marketingConsent: false, now: new Date(now.getTime() - 20 * 864e5) }));
  for (const daysAgo of [18, 11, 4]) {
    await tx(
      (q) => awardPurchase(q, { businessId: bakery.id, membershipId: bm.membershipId, programmeId: bStamps.id, actorUserId: bakeryOwnerId, idempotencyKey: import_node_crypto4.default.randomUUID(), source: "seed", confirmSeparatePurchase: true, now: new Date(now.getTime() - daysAgo * 864e5) })
    );
  }
  const counts = await one(db, `select (select count(*)::int from loyalty_memberships where business_id = $1) as members, (select count(*)::int from loyalty_transactions where business_id = $1) as txns`, [B]);
  console.log(`demo ready in ${((Date.now() - t0) / 1e3).toFixed(1)}s: ${counts.members} members, ${counts.txns} transactions`);
}
async function resetDemoData() {
  await tx(async (q) => {
    const ids = (await many(q, "select id from businesses where is_demo")).map((r) => r.id);
    if (ids.length) {
      const del = async (sql) => q.query(sql, [ids]);
      await del("update loyalty_transactions set reverses_transaction_id = null where business_id = any($1::uuid[])");
      await del("delete from loyalty_transactions where business_id = any($1::uuid[])");
      await del("delete from reward_redemptions where business_id = any($1::uuid[])");
      await del("delete from challenge_completions where business_id = any($1::uuid[])");
      await del("delete from customer_rewards where business_id = any($1::uuid[])");
      await del("delete from campaign_events where business_id = any($1::uuid[])");
      await del("delete from referrals where business_id = any($1::uuid[])");
      await del("delete from visits where business_id = any($1::uuid[])");
      await del("delete from membership_balances where business_id = any($1::uuid[])");
      await del("delete from membership_claims where business_id = any($1::uuid[])");
      await del("delete from loyalty_operations where business_id = any($1::uuid[])");
      await del("delete from challenges where business_id = any($1::uuid[])");
      await del("update loyalty_memberships set referred_by_membership_id = null where business_id = any($1::uuid[])");
      await del("delete from loyalty_memberships where business_id = any($1::uuid[])");
      await del("delete from campaigns where business_id = any($1::uuid[])");
      await del("delete from rewards where business_id = any($1::uuid[])");
      await del("delete from loyalty_programmes where business_id = any($1::uuid[])");
      await del("delete from staff_invitations where business_id = any($1::uuid[])");
      await del("delete from business_members where business_id = any($1::uuid[])");
      await del("delete from subscriptions where business_id = any($1::uuid[])");
      await del("delete from audit_logs where business_id = any($1::uuid[])");
      await del("update businesses set logo_upload_id = null where id = any($1::uuid[])");
      await del("delete from uploads where business_id = any($1::uuid[])");
      await del("delete from businesses where id = any($1::uuid[])");
    }
    await q.query(`delete from customers where is_demo and not exists (select 1 from loyalty_memberships m where m.customer_id = customers.id)`);
    await q.query(
      `delete from users where is_demo and platform_role is null
         and not exists (select 1 from business_members bm where bm.user_id = users.id)
         and not exists (select 1 from customers c join loyalty_memberships m on m.customer_id = c.id where c.user_id = users.id)`
    );
  });
  console.log("demo data removed");
  await seedDemo();
}
var import_node_crypto4, DEMO_SLUG, TZ, POOLS;
var init_demo = __esm({
  "src/server/seed/demo.ts"() {
    "use strict";
    import_node_crypto4 = __toESM(require("node:crypto"), 1);
    init_db();
    init_config();
    init_accounts();
    init_loyalty();
    init_time();
    init_seed();
    DEMO_SLUG = "perkora-demo-cafe";
    TZ = "Asia/Famagusta";
    POOLS = [
      [
        ["Deniz", "Elif", "Kerem", "Zeynep", "Mert", "Ay\u015Fe", "Can", "Ece", "Emir", "Selin", "Hakan", "Buse", "Ozan", "Derya", "Tolga", "\u0130pek", "Kemal", "Nur", "Baran", "Ceren", "Arda", "Melis", "Yusuf", "Irem", "Efe", "Defne"],
        ["Arslan", "Y\u0131lmaz", "Kaya", "Demir", "\u015Eahin", "\xC7elik", "Ayd\u0131n", "\xD6zt\xFCrk", "K\u0131l\u0131\xE7", "Do\u011Fan", "\xD6zkan", "Erdem", "Ko\xE7", "Aksoy", "Tekin", "U\xE7ar", "Polat", "Ate\u015F"]
      ],
      [
        ["Sofia", "Andreas", "Eleni", "Nikos", "Maria", "Christos", "Katerina", "Yiannis"],
        ["Georgiou", "Christou", "Ioannou", "Papadopoulos", "Charalambous", "Nicolaou"]
      ],
      [
        ["Hannah", "Oliver", "Grace", "James", "Emily", "Daniel", "Chloe", "Liam", "Amelia", "Noah", "Lara"],
        ["Wright", "Collins", "Hughes", "Bennett", "Turner", "Price", "Ward", "Ellis"]
      ]
    ];
  }
});

// src/server/seed/seed.ts
var seed_exports = {};
__export(seed_exports, {
  resetDemo: () => resetDemo,
  seedAll: () => seedAll,
  seedPlans: () => seedPlans
});
async function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    await db.query(
      `insert into plans (id, name, description, monthly_price_minor, currency, feature_configuration, is_recommended, sort_order)
       values ($1, $2, $3, $4, 'EUR', $5, $6, $7)
       on conflict (id) do nothing`,
      [p.id, p.name, p.description, p.monthly_price_minor, p.feature_configuration, p.is_recommended, p.sort_order]
    );
  }
}
async function seedAll() {
  await seedPlans();
  console.log("plans ready");
  const { seedDemo: seedDemo2 } = await Promise.resolve().then(() => (init_demo(), demo_exports));
  await seedDemo2();
}
async function resetDemo() {
  const { resetDemoData: resetDemoData2 } = await Promise.resolve().then(() => (init_demo(), demo_exports));
  await resetDemoData2();
}
var init_seed = __esm({
  "src/server/seed/seed.ts"() {
    "use strict";
    init_db();
    init_plans();
  }
});

// src/server/seed/bootstrap.ts
var bootstrap_exports = {};
__export(bootstrap_exports, {
  bootstrap: () => bootstrap,
  ensureDemo: () => ensureDemo
});
async function bootstrap() {
  await migrate();
  await seedPlans();
  console.log("plans ready");
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return console.warn("ADMIN_EMAIL is not a valid email address \u2014 no admin created.");
  const existing = await maybeOne(db, "select id, platform_role from users where lower(email) = $1", [email]);
  if (existing) {
    if (existing.platform_role !== "admin") {
      await db.query(`update users set platform_role = 'admin', status = 'active' where id = $1`, [existing.id]);
      console.log(`${email} is now a platform administrator.`);
    }
    return;
  }
  if (password.length < 12) return console.warn("ADMIN_PASSWORD must be at least 12 characters \u2014 no admin created.");
  await tx((q) => createUser(q, { name: process.env.ADMIN_NAME || "Perkora Admin", email, password, platformRole: "admin" }));
  console.log(`Administrator created: ${email}`);
}
async function ensureDemo() {
  if (!config().DEMO_MODE) return;
  const demo = await maybeOne(db, `select 1 from businesses where slug = 'perkora-demo-cafe'`);
  const complete = await maybeOne(db, `select 1 from businesses where is_demo and default_currency = 'TRY'`);
  if (demo && complete) return;
  const { seedDemo: seedDemo2, resetDemoData: resetDemoData2 } = await Promise.resolve().then(() => (init_demo(), demo_exports));
  if (demo) {
    console.log("demo data incomplete \u2014 rebuilding");
    await resetDemoData2();
  } else {
    console.log("building demo data in the background\u2026");
    await seedDemo2();
  }
}
var init_bootstrap = __esm({
  "src/server/seed/bootstrap.ts"() {
    "use strict";
    init_config();
    init_db();
    init_migrate();
    init_accounts();
    init_seed();
  }
});

// src/server/seed/admin.ts
var admin_exports = {};
__export(admin_exports, {
  createAdminCli: () => createAdminCli
});
async function createAdminCli(args) {
  const arg = (name2) => {
    const i = args.indexOf(`--${name2}`);
    return i >= 0 ? args[i + 1] : void 0;
  };
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Perkora Admin";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Pass --email you@example.com (or set ADMIN_EMAIL).");
  const password = process.env.ADMIN_PASSWORD || import_node_crypto5.default.randomBytes(12).toString("base64url");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const existing = await maybeOne(db, "select id from users where lower(email) = $1", [email]);
  if (existing) {
    await db.query(`update users set platform_role = 'admin', status = 'active' where id = $1`, [existing.id]);
    if (process.env.ADMIN_PASSWORD) {
      await db.query("update user_credentials set password_hash = $2, updated_at = now() where user_id = $1", [existing.id, await hashPassword(password)]);
    }
    console.log(`${email} is now a platform administrator.`);
    return;
  }
  await tx((q) => createUser(q, { name, email, password, platformRole: "admin" }));
  console.log(`Administrator created: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once): ${password}`);
}
var import_node_crypto5;
var init_admin = __esm({
  "src/server/seed/admin.ts"() {
    "use strict";
    import_node_crypto5 = __toESM(require("node:crypto"), 1);
    init_db();
    init_accounts();
    init_crypto();
  }
});

// src/server/cli.ts
init_config();
init_db();
loadEnvFile();
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "migrate": {
      const { migrate: migrate2 } = await Promise.resolve().then(() => (init_migrate(), migrate_exports));
      await migrate2();
      break;
    }
    case "seed": {
      const { seedAll: seedAll2 } = await Promise.resolve().then(() => (init_seed(), seed_exports));
      await seedAll2();
      break;
    }
    case "demo-reset": {
      const { resetDemo: resetDemo2 } = await Promise.resolve().then(() => (init_seed(), seed_exports));
      await resetDemo2();
      break;
    }
    case "bootstrap": {
      const { bootstrap: bootstrap2 } = await Promise.resolve().then(() => (init_bootstrap(), bootstrap_exports));
      await bootstrap2();
      break;
    }
    case "create-admin": {
      const { createAdminCli: createAdminCli2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
      await createAdminCli2(args);
      break;
    }
    default:
      console.log('Usage: node dist/cli.cjs <migrate|bootstrap|seed|demo-reset|create-admin --email you@example.com --name "Your Name">');
      process.exitCode = 1;
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}).finally(() => closePool());
//# sourceMappingURL=cli.cjs.map
