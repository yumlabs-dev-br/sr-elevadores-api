-- Chamadas de elevador: uma linha por pessoa que apertou o botão.
CREATE TABLE IF NOT EXISTS chamadas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  andar       INTEGER NOT NULL CHECK (andar BETWEEN 0 AND 9),
  destino     INTEGER NOT NULL CHECK (destino BETWEEN 0 AND 9),
  status      TEXT    NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_viagem', 'concluida')),
  elevador    TEXT,
  criada_em   INTEGER NOT NULL,
  embarque_em INTEGER,
  chegada_em  INTEGER
);

CREATE INDEX IF NOT EXISTS chamadas_status ON chamadas (status);
CREATE INDEX IF NOT EXISTS chamadas_andar ON chamadas (andar);
