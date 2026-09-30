#property strict
#property version   "1.1"
#property description "Sultan read-only MT5 history synchronizer"

input string InpSyncUrl = "https://uwbglnkdsgwbjorqxvcj.supabase.co/functions/v1/mt5-sync";
input string InpPublishableKey = "";
input string InpConnectionKey = "";
input int    InpBackfillDays = 90;
input int    InpOverlapMinutes = 10;
input int    InpPollSeconds = 30;
input int    InpBatchSize = 50;

datetime g_cursor = 0;
datetime g_last_sync = 0;
bool g_trade_changed = false;
bool g_busy = false;

string JsonEscape(const string value)
  {
   string result = "";
   for(int i = 0; i < StringLen(value); i++)
     {
      ushort c = StringGetCharacter(value, i);
      if(c == '"' || c == '\\') result += "\\" + ShortToString(c);
      else if(c == '\r') result += "\\r";
      else if(c == '\n') result += "\\n";
      else if(c == '\t') result += "\\t";
      else result += ShortToString(c);
     }
   return result;
  }

string DealTypeName(const long deal_type)
  {
   switch((ENUM_DEAL_TYPE)deal_type)
     {
      case DEAL_TYPE_BUY: return "buy";
      case DEAL_TYPE_SELL: return "sell";
      case DEAL_TYPE_BALANCE: return "balance";
      case DEAL_TYPE_CREDIT: return "credit";
      case DEAL_TYPE_CHARGE: return "charge";
      case DEAL_TYPE_CORRECTION: return "correction";
      case DEAL_TYPE_BONUS: return "bonus";
      case DEAL_TYPE_COMMISSION: return "commission";
      case DEAL_TYPE_COMMISSION_DAILY: return "commission_daily";
      case DEAL_TYPE_COMMISSION_MONTHLY: return "commission_monthly";
      case DEAL_TYPE_COMMISSION_AGENT_DAILY: return "commission_daily";
      case DEAL_TYPE_COMMISSION_AGENT_MONTHLY: return "commission_monthly";
      case DEAL_TYPE_INTEREST: return "interest";
      case DEAL_TYPE_BUY_CANCELED: return "correction";
      case DEAL_TYPE_SELL_CANCELED: return "correction";
      case DEAL_DIVIDEND: return "dividend";
      case DEAL_DIVIDEND_FRANKED: return "dividend";
      case DEAL_TAX: return "tax";
      default: return "other";
     }
  }

string EntryTypeName(const long entry_type)
  {
   switch((ENUM_DEAL_ENTRY)entry_type)
     {
      case DEAL_ENTRY_IN: return "in";
      case DEAL_ENTRY_OUT: return "out";
      case DEAL_ENTRY_INOUT: return "inout";
      case DEAL_ENTRY_OUT_BY: return "out_by";
      default: return "other";
     }
  }

string DealJson(const ulong ticket)
  {
   long order_id = HistoryDealGetInteger(ticket, DEAL_ORDER);
   long position_id = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
   long time_msc = HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
   long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
   long entry_type = HistoryDealGetInteger(ticket, DEAL_ENTRY);
   string symbol = JsonEscape(HistoryDealGetString(ticket, DEAL_SYMBOL));
   return StringFormat(
      "{\"ticket\":\"%I64u\",\"order_id\":\"%I64d\",\"position_id\":\"%I64d\",\"time_msc\":\"%I64d\",\"deal_type\":\"%s\",\"entry_type\":\"%s\",\"symbol\":\"%s\",\"volume\":\"%s\",\"price\":\"%s\",\"profit\":\"%s\",\"commission\":\"%s\",\"swap\":\"%s\",\"fee\":\"%s\",\"currency\":\"%s\"}",
      ticket, order_id, position_id, time_msc,
      DealTypeName(deal_type), EntryTypeName(entry_type), symbol,
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 8),
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), 10),
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_PROFIT), 8),
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 8),
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_SWAP), 8),
      DoubleToString(HistoryDealGetDouble(ticket, DEAL_FEE), 8),
      JsonEscape(AccountInfoString(ACCOUNT_CURRENCY))
   );
  }

bool SendBatch(const string deals_json, const int count)
  {
   string body = StringFormat(
      "{\"broker_server\":\"%s\",\"account_login\":\"%I64d\",\"balance\":%s,\"equity\":%s,\"currency\":\"%s\",\"deals\":[%s]}",
      JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
      AccountInfoInteger(ACCOUNT_LOGIN),
      DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 8),
      DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 8),
      JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)),
      deals_json
   );
   char data[];
   int copied = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied <= 1) return false;
   ArrayResize(data, copied - 1);
   char response[];
   string response_headers;
   string headers = "Content-Type: application/json\r\napikey: " + InpPublishableKey +
                    "\r\nAuthorization: Bearer " + InpConnectionKey + "\r\n";
   ResetLastError();
   int status = WebRequest("POST", InpSyncUrl, headers, 7000, data, response, response_headers);
   if(status != 200)
     {
      PrintFormat("Sultan sync failed (HTTP %d, MT5 error %d), batch size %d.", status, GetLastError(), count);
      return false;
     }
   return true;
  }

bool SynchronizeHistory()
  {
   if(g_busy) return false;
   g_busy = true;
   datetime until = TimeCurrent();
   datetime from = g_cursor;
   if(from <= 0) from = until - MathMax(1, InpBackfillDays) * 86400;
   else from = MathMax(0, from - MathMax(1, InpOverlapMinutes) * 60);
   if(!HistorySelect(from, until))
     {
      Print("Sultan could not read MT5 history. Check the terminal connection and selected date range.");
      g_busy = false;
      return false;
     }

   int total = HistoryDealsTotal();
   string batch = "";
   int batch_count = 0;
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if(batch_count > 0) batch += ",";
      batch += DealJson(ticket);
      batch_count++;
      if(batch_count >= MathMax(1, MathMin(InpBatchSize, 100)))
        {
         if(!SendBatch(batch, batch_count)) { g_busy = false; return false; }
         batch = "";
         batch_count = 0;
        }
     }
   if(batch_count > 0 && !SendBatch(batch, batch_count)) { g_busy = false; return false; }
   if(total == 0 && !SendBatch("", 0)) { g_busy = false; return false; }

   g_cursor = until;
   g_last_sync = until;
   g_trade_changed = false;
   string cursor_key = "SultanMT5_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + StringSubstr(InpConnectionKey, 0, 8);
   StringReplace(cursor_key, "-", "_");
   GlobalVariableSet(cursor_key, (double)g_cursor);
   g_busy = false;
   return true;
  }

int OnInit()
  {
   if(StringLen(InpConnectionKey) < 40 || StringLen(InpPublishableKey) < 20 || StringFind(InpSyncUrl, "https://") != 0)
     {
      Print("Enter the one-time Sultan connection key and public API key in the EA inputs.");
      return INIT_PARAMETERS_INCORRECT;
     }
   string cursor_key = "SultanMT5_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + StringSubstr(InpConnectionKey, 0, 8);
   StringReplace(cursor_key, "-", "_");
   if(GlobalVariableCheck(cursor_key)) g_cursor = (datetime)GlobalVariableGet(cursor_key);
   else g_cursor = TimeCurrent() - MathMax(1, InpBackfillDays) * 86400;
   EventSetTimer(MathMax(10, InpPollSeconds));
   SynchronizeHistory();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   if(g_trade_changed || TimeCurrent() - g_last_sync >= MathMax(10, InpPollSeconds))
      SynchronizeHistory();
  }

void OnTradeTransaction(const MqlTradeTransaction &transaction,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   g_trade_changed = true;
  }

