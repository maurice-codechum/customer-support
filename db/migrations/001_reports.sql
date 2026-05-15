CREATE TABLE reports (
  id              BIGSERIAL PRIMARY KEY,
  university_id   BIGINT NOT NULL,
  college_id      BIGINT,
  department_id   BIGINT,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  template_name   TEXT NOT NULL,
  template_blob   BYTEA NOT NULL,
  recommendations TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_product_highlights (
  id                BIGSERIAL PRIMARY KEY,
  report_id         BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position          INT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  short_description TEXT NOT NULL,
  image_blob        BYTEA,
  image_mime        TEXT
);

CREATE TABLE report_teacher_feedbacks (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  teacher_name    TEXT NOT NULL,
  department_name TEXT NOT NULL,
  feedback        TEXT NOT NULL
);

CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_pgh_report ON report_product_highlights(report_id);
CREATE INDEX idx_fbk_report ON report_teacher_feedbacks(report_id);
