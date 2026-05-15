CREATE TABLE report_rosters (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT,
  college         TEXT,
  department      TEXT,
  course_code     TEXT,
  section         TEXT
);

CREATE INDEX idx_roster_report ON report_rosters(report_id);
