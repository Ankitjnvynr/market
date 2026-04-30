import React from "react";

const OptionChainTable = ({ loading, optionChain }) => {
    if (loading) {
        return <p>Loading option chain...</p>;
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <table
                border="1"
                cellPadding="8"
                cellSpacing="0"
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                }}
            >
                <thead>
                    <tr>
                        <th>CE OI</th>
                        <th>CE change OI</th>
                        <th>CE LTP</th>
                        <th>CE Vol</th>
                        <th>Strike</th>
                        <th>PE Vol</th>
                        <th>PE LTP</th>
                        <th>PE change OI</th>
                        <th>PE OI</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const spot = Number(
                            optionChain?.[0]?.CE?.underlyingValue ||
                            optionChain?.[0]?.PE?.underlyingValue ||
                            0
                        );

                        const roundFigureRows = optionChain.filter((row) => {
                            const strike = Number(row.strikePrice);
                            return strike % 100 === 0;
                        });

                        const firstResistance = roundFigureRows.find((row) => {
                            const strike = Number(row.strikePrice);
                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);
                            return strike >= spot && ceOI > 0 && peOI > 0 && ceOI >= peOI * 2;
                        });

                        const supportCandidates = roundFigureRows.filter((row) => {
                            const strike = Number(row.strikePrice);
                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);
                            return strike <= spot && peOI > 0 && ceOI > 0 && peOI >= ceOI * 2;
                        });

                        const lastSupport = supportCandidates[supportCandidates.length - 1];

                        const supportStrike = Number(lastSupport?.strikePrice || 0);
                        const resistanceStrike = Number(firstResistance?.strikePrice || 0);

                        const nearbyDriverRows = roundFigureRows.filter((row) => {
                            const strike = Number(row.strikePrice);
                            return Math.abs(strike - spot) <= 300;
                        });

                        const metricLeaders = nearbyDriverRows.map((row) => {
                            const strike = Number(row.strikePrice);

                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);

                            const ceChgOI = Number(row.CE?.changeinOpenInterest || 0);
                            const peChgOI = Number(row.PE?.changeinOpenInterest || 0);

                            const ceVol = Number(row.CE?.totalTradedVolume || 0);
                            const peVol = Number(row.PE?.totalTradedVolume || 0);

                            const cePressure =
                                (ceChgOI > peChgOI ? 3 : 0) +
                                (ceVol > peVol ? 2 : 0) +
                                (ceOI > peOI ? 1 : 0);

                            const pePressure =
                                (peChgOI > ceChgOI ? 3 : 0) +
                                (peVol > ceVol ? 2 : 0) +
                                (peOI > ceOI ? 1 : 0);

                            const netPressure = pePressure - cePressure;

                            return {
                                strike,
                                netPressure,
                                distance: Math.abs(strike - spot),
                                dominantSide:
                                    netPressure > 0 ? "PE" : netPressure < 0 ? "CE" : null,
                                totalStrength: Math.abs(netPressure),
                            };
                        });

                        const sortedDrivers = [...metricLeaders].sort((a, b) => {
                            if (b.totalStrength !== a.totalStrength) {
                                return b.totalStrength - a.totalStrength;
                            }
                            return a.distance - b.distance;
                        });

                        const strongestDriver = sortedDrivers[0];
                        const secondStrongestDriver = sortedDrivers[1];

                        const marketDriverStrike = strongestDriver?.strike || 0;
                        const secondDriverStrike = secondStrongestDriver?.strike || 0;

                        const marketDirection =
                            strongestDriver?.netPressure > 0
                                ? "UPSIDE"
                                : strongestDriver?.netPressure < 0
                                    ? "DOWNSIDE"
                                    : "SIDEWAYS";

                        const targetStrike =
                            marketDirection === "UPSIDE"
                                ? resistanceStrike
                                : marketDirection === "DOWNSIDE"
                                    ? supportStrike
                                    : spot;

                        return optionChain.map((row, index) => {
                            const strike = Number(row.strikePrice);
                            const rowSpot = Number(
                                row.CE?.underlyingValue || row.PE?.underlyingValue || 0
                            );

                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);

                            const ceChgOI = Number(row.CE?.changeinOpenInterest || 0);
                            const peChgOI = Number(row.PE?.changeinOpenInterest || 0);

                            const ceVol = Number(row.CE?.totalTradedVolume || 0);
                            const peVol = Number(row.PE?.totalTradedVolume || 0);

                            const isATM = Math.abs(strike - rowSpot) <= 50;
                            const isSupport = strike === supportStrike;
                            const isResistance = strike === resistanceStrike;

                            const isMarketDriver = strike === marketDriverStrike;
                            const isSecondDriver = strike === secondDriverStrike;
                            const isTargetStrike = strike === targetStrike;

                            const currentDriver = metricLeaders.find((d) => d.strike === strike);
                            const dominantSide = currentDriver?.dominantSide || null;

                            let rowBg = "";
                            if (isTargetStrike) rowBg = "#7c2d12";
                            else if (isMarketDriver) rowBg = "#1e3a8a";
                            else if (isSecondDriver) rowBg = "#312e81";
                            else if (isResistance) rowBg = "#3b0a0a";
                            else if (isSupport) rowBg = "#0b2e13";
                            else if (isATM) rowBg = "#4a3b00";
                            else rowBg = "#111827";

                            const highlightCell = (active) => ({
                                backgroundColor: active ? "rgba(255,255,255,0.16)" : "transparent",
                                fontWeight: active ? "700" : "400",
                                border: active ? "1px solid rgba(255,255,255,0.18)" : "none",
                            });

                            const highlightCE = dominantSide === "CE" && isMarketDriver;
                            const highlightPE = dominantSide === "PE" && isMarketDriver;

                            // Single icon priority (prevents overlap)
                            let strikeIcon = "";
                            if (isTargetStrike) {
                                strikeIcon =
                                    marketDirection === "UPSIDE"
                                        ? " 🚀"
                                        : marketDirection === "DOWNSIDE"
                                            ? " ⚡"
                                            : " ⚪";
                            } else if (isMarketDriver) {
                                strikeIcon = dominantSide === "PE" ? " 🔵" : " 🟠";
                            } else if (isSecondDriver) {
                                strikeIcon = " 🟣";
                            } else if (isResistance) {
                                strikeIcon = " 🟢";
                            } else if (isSupport) {
                                strikeIcon = " 🔴";
                            }

                            return (
                                <tr
                                    key={index}
                                    style={{
                                        backgroundColor: rowBg,
                                        color: "#fff",
                                        fontWeight:
                                            isTargetStrike ||
                                                isMarketDriver ||
                                                isSecondDriver ||
                                                isResistance ||
                                                isSupport ||
                                                isATM
                                                ? "bold"
                                                : "normal",
                                    }}
                                >
                                    <td style={highlightCell(highlightCE)}>{ceOI}</td>
                                    <td style={highlightCell(highlightCE)}>{ceChgOI}</td>
                                    <td>{row.CE?.lastPrice ?? "-"}</td>
                                    <td style={highlightCell(highlightCE)}>{ceVol}</td>

                                    <td>
                                        {strike}
                                        {strikeIcon}
                                    </td>

                                    <td style={highlightCell(highlightPE)}>{peVol}</td>
                                    <td>{row.PE?.lastPrice ?? "-"}</td>
                                    <td style={highlightCell(highlightPE)}>{peChgOI}</td>
                                    <td style={highlightCell(highlightPE)}>{peOI}</td>
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