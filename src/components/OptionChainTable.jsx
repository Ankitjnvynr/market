import React from "react";

const OptionChainTable = ({ loading, optionChain }) => {
  if (loading) return <p>Loading option chain...</p>;
  if (!optionChain?.length) return <p>No option chain data found.</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        border="1"
        cellPadding="8"
        cellSpacing="0"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr style={{ background: "#0f172a", color: "#fff" }}>
            <th>CE OI</th>
            <th>CE Chg</th>
            <th>CE LTP</th>
            <th>CE Vol</th>
            <th>Strike / Reversal Level</th>
            <th>PE Vol</th>
            <th>PE LTP</th>
            <th>PE Chg</th>
            <th>PE OI</th>
          </tr>
        </thead>

        <tbody>
          {(() => {
            const safe = (v) => Number(v || 0);
            const snap = (v) => Math.round(v / 12.5) * 12.5;
            const L = (v) => Number(v || 0).toLocaleString("en-IN");

            const spot = safe(
              optionChain?.[0]?.CE?.underlyingValue ||
                optionChain?.[0]?.PE?.underlyingValue
            );

            // working round figures only
            const roundRows = optionChain.filter(
              (r) => safe(r.strikePrice) % 100 === 0
            );

            const nearbyRounds = roundRows.filter(
              (r) => Math.abs(safe(r.strikePrice) - spot) <= 300
            );

            const reversalMap = {};

            nearbyRounds.forEach((row) => {
              const strike = safe(row.strikePrice);

              const ceOI = safe(row.CE?.openInterest);
              const peOI = safe(row.PE?.openInterest);
              const ceChg = safe(row.CE?.changeinOpenInterest);
              const peChg = safe(row.PE?.changeinOpenInterest);
              const ceVol = safe(row.CE?.totalTradedVolume);
              const peVol = safe(row.PE?.totalTradedVolume);

              const up = optionChain.find(
                (r) => safe(r.strikePrice) === strike + 50
              );
              const dn = optionChain.find(
                (r) => safe(r.strikePrice) === strike - 50
              );

              const upPEVol = safe(up?.PE?.totalTradedVolume);
              const dnCEVol = safe(dn?.CE?.totalTradedVolume);

              // stronger real reversal = weighted OI wall + volume participation
              const supportPressure =
                peOI * 0.5 + Math.max(peChg, 0) * 0.3 + peVol * 0.2;

              const resistancePressure =
                ceOI * 0.5 + Math.max(ceChg, 0) * 0.3 + ceVol * 0.2;

              // support reversal = weighted defended floor
              const supportReverse = snap(
                strike +
                  ((upPEVol + Math.max(peChg, 0)) /
                    Math.max(1, peVol + upPEVol + Math.max(peChg, 0))) *
                    50
              );

              // resistance reversal = weighted defended ceiling
              const resistanceReverse = snap(
                strike -
                  ((dnCEVol + Math.max(ceChg, 0)) /
                    Math.max(1, ceVol + dnCEVol + Math.max(ceChg, 0))) *
                    50
              );

              // choose only stronger side (market actually reacts here more often)
              const reversalLevel =
                supportPressure > resistancePressure
                  ? supportReverse
                  : resistanceReverse;

              reversalMap[strike] = reversalLevel;
            });

            return optionChain.map((row, index) => {
              const strike = safe(row.strikePrice);
              const ceOI = safe(row.CE?.openInterest);
              const peOI = safe(row.PE?.openInterest);
              const ceChg = safe(row.CE?.changeinOpenInterest);
              const peChg = safe(row.PE?.changeinOpenInterest);
              const ceVol = safe(row.CE?.totalTradedVolume);
              const peVol = safe(row.PE?.totalTradedVolume);

              const reversalLevel = reversalMap[strike];
              const isRoundInRange = reversalLevel !== undefined;
              const isATM = Math.abs(strike - spot) <= 50;

              let rowBg = "#111827";
              if (isRoundInRange && reversalLevel < strike) rowBg = "#3b0a0a";
              else if (isRoundInRange && reversalLevel > strike) rowBg = "#0b2e13";
              else if (isATM) rowBg = "#4a3b00";

              return (
                <tr
                  key={index}
                  style={{
                    backgroundColor: rowBg,
                    color: "#fff",
                    fontWeight: isRoundInRange || isATM ? "bold" : "normal",
                  }}
                >
                  <td>{L(ceOI)}</td>
                  <td>{L(ceChg)}</td>
                  <td>{row.CE?.lastPrice ?? "-"}</td>
                  <td>{L(ceVol)}</td>

                  <td style={{ textAlign: "center", minWidth: "170px" }}>
                    <div>{strike}</div>

                    {isRoundInRange && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "10px",
                          color:
                            reversalLevel < strike ? "#fca5a5" : "#86efac",
                        }}
                      >
                        Reverse ≈ {reversalLevel}
                      </div>
                    )}
                  </td>

                  <td>{L(peVol)}</td>
                  <td>{row.PE?.lastPrice ?? "-"}</td>
                  <td>{L(peChg)}</td>
                  <td>{L(peOI)}</td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
};

export default OptionChainTable;