#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Accadde Oggi — Add curiosity-inducing push notifications that include the actual event or half of it as a hook to make users open the app."

backend:
  - task: "GET /api/events/teasers — Curiosity teaser endpoint for push notifications"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added new endpoint /api/events/teasers returning up to N curated event teasers per day with fields: id, year, years_ago, category, scope, title, title_short (≤60 chars), text_short (≤95 chars ending with '…'). Supports params: lang (it|en|es), country, month, day (defaults to today), count (1-50). Scoring favors round-number anniversaries, events with images, global scope, and user interests. Requires auth (JWT). Added _truncate_teaser helper that cleanly truncates at sentence/word boundaries."
      - working: true
        agent: "testing"
        comment: "All backend tests PASS. Endpoint returns HTTP 200 with correct shape {date:{month,day,year}, lang, country, count, teasers:[...]}. All teasers contain required fields (id, year, years_ago, category, scope, title, title_short, text_short). text_short always ≤100 chars and ends with '…' when truncated (14/20 truncated examples verified). title_short always ≤65 chars. ?lang=en and ?lang=es correctly change returned 'lang' field; for today's date (Apr 19) 2/30 events have distinct EN text while 28/30 fall back to IT — fallback is acceptable per spec (e.g., Pope Benedict XVI election and Manson sentencing differ correctly in EN). ?month=7&day=20 returns July 20 events including 1969 entries. ?count=5 correctly returns ≤5 teasers. Unauthenticated request returns 401. No 500 errors observed. Regression: POST /api/auth/login, GET /api/auth/me, GET /api/events/today, GET /api/events/stats all still return 200."

frontend:
  - task: "Push notifications with real event teasers + curiosity hooks"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/services/notifications.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote scheduleRandomDailyNotifications to fetch real event teasers from /api/events/teasers and rotate 50/50 between: (A) Real excerpt format '📜 YEAR · X anni fa' + truncated real text; (B) Curiosity hook format 'Sai cosa accadde nel YEAR?' + intriguing body per category. Falls back to generic templates if network fails. Schedules 14 days × 3-4 random slots in chosen time window. Fetches day-specific teasers for next 3 days. Added sendPreviewNotification() that fires an immediate sample. Added eventId in notification data payload."
  - task: "Profile notification preview UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 'ANTEPRIMA PROSSIMA NOTIFICA' card showing exact title+body+time of next scheduled notification, and a 'PROVA NOTIFICA ORA' button that triggers sendPreviewNotification() to fire a real teaser notification ~2 seconds later so user can see the format on their device."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/events/teasers — Curiosity teaser endpoint for push notifications"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Implementato sistema di notifiche push accattivanti. Testare backend /api/events/teasers: autenticazione richiesta, verifica che restituisca teaser con campi 'text_short' e 'title_short' troncati, verifica parametri lang/country/month/day/count, verifica scoring (eventi con anniversari tondi in cima). Credenziali test: /app/memory/test_credentials.md."
  - agent: "testing"
    message: "✅ Backend GET /api/events/teasers fully tested and PASSING. 15/16 assertions passed; the 1 'failure' was a language-diff check that's actually expected fallback behavior (many April 19 events only exist in it.wiki so EN falls back to IT, which is explicitly allowed per review request). Confirmed with broader sampling: 2/30 events differ between lang=it and lang=en — e.g., 'Pope Benedict XVI elected' and 'Charles Manson sentencing' show correct English text. All required fields present; title_short ≤65 chars; text_short ≤100 chars, ending with '…' when truncated (14/20 samples). ?month=7&day=20&count=50 returns July 20 events including year 1969. ?count=5 caps results. Unauthenticated returns 401. Regression endpoints (auth/login, auth/me, events/today, events/stats) all return 200. No 500 errors. Main agent can summarize and finish — no code changes required."
