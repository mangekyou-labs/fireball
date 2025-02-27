"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
var path_1 = __importDefault(require("path"));
var url_1 = require("url");
var serverless_1 = require("@neondatabase/serverless");
var ws_1 = __importDefault(require("ws"));
// Configure Neon to use the ws package
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
// Get the directory name in ESM
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
// Load environment variables from .env file
(0, dotenv_1.config)({ path: path_1.default.resolve(__dirname, '../.env') });
console.log('Checking database tables...');
console.log('Using DATABASE_URL:', ((_a = process.env.DATABASE_URL) === null || _a === void 0 ? void 0 : _a.substring(0, 40)) + '...');
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please check your .env file.');
    process.exit(1);
}
var pool = new serverless_1.Pool({ connectionString: process.env.DATABASE_URL });
function checkDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var result, sessionsResult, logsResult, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, 5, 7]);
                    return [4 /*yield*/, pool.query("\n      SELECT table_name \n      FROM information_schema.tables \n      WHERE table_schema = 'public'\n      ORDER BY table_name;\n    ")];
                case 1:
                    result = _a.sent();
                    console.log('Tables in database:');
                    if (result.rows.length === 0) {
                        console.log('No tables found in the database.');
                    }
                    else {
                        result.rows.forEach(function (row) {
                            console.log("- ".concat(row.table_name));
                        });
                    }
                    return [4 /*yield*/, pool.query("\n      SELECT COUNT(*) FROM trading_sessions;\n    ").catch(function (err) {
                            console.log('Error checking trading_sessions table:', err.message);
                            return { rows: [{ count: 'table does not exist' }] };
                        })];
                case 2:
                    sessionsResult = _a.sent();
                    console.log("Number of trading sessions: ".concat(sessionsResult.rows[0].count));
                    return [4 /*yield*/, pool.query("\n      SELECT COUNT(*) FROM wallet_activity_logs;\n    ").catch(function (err) {
                            console.log('Error checking wallet_activity_logs table:', err.message);
                            return { rows: [{ count: 'table does not exist' }] };
                        })];
                case 3:
                    logsResult = _a.sent();
                    console.log("Number of wallet activity logs: ".concat(logsResult.rows[0].count));
                    return [3 /*break*/, 7];
                case 4:
                    error_1 = _a.sent();
                    console.error('Error checking database:', error_1);
                    return [3 /*break*/, 7];
                case 5: 
                // Close the pool
                return [4 /*yield*/, pool.end()];
                case 6:
                    // Close the pool
                    _a.sent();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Run the check
checkDatabase().catch(console.error);
