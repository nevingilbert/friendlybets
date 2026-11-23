import { NotAllowedError, NotSignedInError } from "@/lib/errors";

function postgresErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Turns anything thrown below an action into a message a guest can act on.
 *
 * The plpgsql functions raise messages already written for humans ("Someone already
 * took this bet"), so those pass straight through; only infrastructure codes are
 * translated, and anything else unexpected is not echoed to the browser.
 */
export function describeError(error: unknown): string {
  if (error instanceof NotSignedInError || error instanceof NotAllowedError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";

  switch (postgresErrorCode(error)) {
    case "P0001": // raise exception without a code
    case "P0002": // no_data_found — "Bet not found", "No lobby with that code"
    case "22023": // invalid_parameter_value — our own validation raises
    case "42501": // insufficient_privilege — "Only the host can …"
      return message || "The server would not accept that.";
    case "23514": // check_violation
      return "That is too long or not allowed.";
    case "42P01": // undefined_table
    case "42883": // undefined_function
      return "The database is missing its tables. Run `npm run db:migrate`, then try again.";
    case "28P01":
    case "28000":
      return "The database refused the credentials in DATABASE_URL.";
    case "53300":
      return "The database is out of connections. Wait a moment and try again.";
    case "57P01":
    case "57P03":
      return "The database is starting up. Try again in a few seconds.";
    case "CONNECT_TIMEOUT":
    case "ECONNREFUSED":
    case "ENOTFOUND":
      return "Could not reach the database. Try again.";
    default:
      break;
  }

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout|network/i.test(message)) {
    return "Could not reach the database. Try again.";
  }

  console.error(error);
  return "Something went wrong. Try again.";
}
