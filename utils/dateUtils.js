import moment from "moment-timezone";

const DATE_FORMATS = ["YYYY-MM-DD", "DD-MM-YYYY"];

export const istStartOfDay = (date) => {
  if (!date) return null;

  const m = moment.tz(date, DATE_FORMATS, true, "Asia/Kolkata");
  if (!m.isValid()) return null;

  return m.startOf("day").toDate();
};

export const istEndOfDay = (date) => {
  if (!date) return null;

  const m = moment.tz(date, DATE_FORMATS, true, "Asia/Kolkata");
  if (!m.isValid()) return null;

  return m.endOf("day").toDate();
};

export const istDateOnly = (date) => {
  if (!date) return null;

  const m = moment.tz(date, DATE_FORMATS, true, "Asia/Kolkata");
  if (!m.isValid()) return null;

  return m.format("YYYY-MM-DD");
};

export const istNow = () => moment.tz("Asia/Kolkata").toDate();
