import React, { useEffect, useMemo, useState } from "react";
import type { OptionChainRow } from "../types/optionChain";

interface Props {
    loading: boolean;
    optionChain?: OptionChainRow[];
    fetchOptionChain?: () => Promise<OptionChainRow[] | undefined>;
}

const OptionChainTable: React.FC<Props> = ({ loading, optionChain = [], fetchOptionChain }) => {
    const [liveData, setLiveData] = useState<OptionChainRow[]>(optionChain);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        setLiveData(optionChain);
        setLastUpdated(new Date());
    }, [optionChain]);

    useEffect(() => {
        if (!fetchOptionChain) return;

        const interval = setInterval(async () => {
            try {
                const fresh = await fetchOptionChain();
                if (fresh?.length) {
                    setLiveData(fresh);
                    setLastUpdated(new Date());
                }
            } catch (err) {
                console.error("Auto refresh failed:", err);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [fetchOptionChain]);

    const {
        tableRows,
        pressureSide,
        callBuy,
        putBuy,
        waitLow,
        waitHigh,
        tradeSignal,
        etaText,
    } = useMemo(() => {
        if (!liveData?.length) {
            return {
                tableRows: [] as React.ReactNode[],
                pressureSide: "NEUTRAL",
                nearestPEWall: null,
                nearestCEWall: null,
                callBuy: null,
                putBuy: null,
                waitLow: null,
                waitHigh: null,
                tradeSignal: "WAIT",
                etaText: "--",
            };
        }

        const safe = (v: unknown) => Number(v || 0);
        const snap = (v: number) => Math.round(v / 12.5) * 12.5;
        const L = (v: unknown) => Number(v || 0).toLocaleString("en-IN");

        const spot = safe(
            (liveData?.[0]?.CE as any)?.underlyingValue ||
                (liveData?.[0]?.PE as any)?.underlyingValue
        );

        const roundRows = liveData.filter((r) => safe(r.strikePrice) % 100 === 0);

        const nearbyRounds = roundRows.filter(
            (r) => Math.abs(safe(r.strikePrice) - spot) <= 300
        );

        const reversalMap: Record<number, number> = {};

        nearbyRounds.forEach((row) => {
            const strike = safe(row.strikePrice);

            const ceOI = safe((row.CE as any)?.openInterest);
            const peOI = safe((row.PE as any)?.openInterest);
            const ceChg = safe((row.CE as any)?.changeinOpenInterest);
            const peChg = safe((row.PE as any)?.changeinOpenInterest);
            const ceVol = safe((row.CE as any)?.totalTradedVolume);
            const peVol = safe((row.PE as any)?.totalTradedVolume);

            const up = liveData.find((r) => safe(r.strikePrice) === strike + 50);
            const dn = liveData.find((r) => safe(r.strikePrice) === strike - 50);

            const upPEVol = safe((up?.PE as any)?.totalTradedVolume);
            const dnCEVol = safe((dn?.CE as any)?.totalTradedVolume);

            const supportPressure =
                peOI * 0.5 + Math.max(peChg, 0) * 0.3 + peVol * 0.2;

            const resistancePressure =
                ceOI * 0.5 + Math.max(ceChg, 0) * 0.3 + ceVol * 0.2;

            const supportReverse = snap(
                strike +
                    ((upPEVol + Math.max(peChg, 0)) /
                        Math.max(1, peVol + upPEVol + Math.max(peChg, 0))) *
                        50
            );

            const resistanceReverse = snap(
                strike -
                    ((dnCEVol + Math.max(ceChg, 0)) /
                        Math.max(1, ceVol + dnCEVol + Math.max(ceChg, 0))) *
                        50
            );

            reversalMap[strike] =
                supportPressure > resistancePressure ? supportReverse : resistanceReverse;
        });

        let highestValue = 0;

        liveData.forEach((row) => {
            const ceOI = safe((row.CE as any)?.openInterest);
            const peOI = safe((row.PE as any)?.openInterest);
            const ceChg = Math.max(0, safe((row.CE as any)?.changeinOpenInterest));
            const peChg = Math.max(0, safe((row.PE as any)?.changeinOpenInterest));
            const ceVol = safe((row.CE as any)?.totalTradedVolume);
            const peVol = safe((row.PE as any)?.totalTradedVolume);

            highestValue = Math.max(
                highestValue,
                ceOI,
                peOI,
                ceChg,
                peChg,
                ceVol,
                peVol
            );
        });

        const threshold75 = highestValue * 0.75;
        const strongPEWalls: Array<{ strike: number; value: number; distance: number }> = [];
        const strongCEWalls: Array<{ strike: number; value: number; distance: number }> = [];

        liveData.forEach((row) => {
            const strike = safe(row.strikePrice);
            const ceOI = safe((row.CE as any)?.openInterest);
            const peOI = safe((row.PE as any)?.openInterest);
            const ceChg = Math.max(0, safe((row.CE as any)?.changeinOpenInterest));
            const peChg = Math.max(0, safe((row.PE as any)?.changeinOpenInterest));
            const ceVol = safe((row.CE as any)?.totalTradedVolume);
            const peVol = safe((row.PE as any)?.totalTradedVolume);

            const peMax = Math.max(peOI, peChg, peVol);
            const ceMax = Math.max(ceOI, ceChg, ceVol);

            if (peMax >= threshold75) {
                strongPEWalls.push({
                    strike,
                    value: peMax,
                    distance: Math.abs(strike - spot),
                });
            }

            if (ceMax >= threshold75) {
                strongCEWalls.push({
                    strike,
                    value: ceMax,
                    distance: Math.abs(strike - spot),
                });
            }
        });

        strongPEWalls.sort((a, b) =>
            a.distance !== b.distance ? a.distance - b.distance : b.value - a.value
        );
        strongCEWalls.sort((a, b) =>
            a.distance !== b.distance ? a.distance - b.distance : b.value - a.value
        );

        const nearestPEWall = strongPEWalls[0] || null;
        const nearestCEWall = strongCEWalls[0] || null;

        const pressureSide =
            nearestPEWall && nearestCEWall
                ? nearestPEWall.distance < nearestCEWall.distance
                    ? "UPSIDE"
                    : "DOWNSIDE"
                : nearestPEWall
                ? "UPSIDE"
                : nearestCEWall
                ? "DOWNSIDE"
                : "NEUTRAL";

        const callBuy = nearestPEWall
            ? reversalMap[nearestPEWall.strike] || nearestPEWall.strike
            : null;

        const putBuy = nearestCEWall
            ? reversalMap[nearestCEWall.strike] || nearestCEWall.strike
            : null;

        const waitLow = callBuy ? callBuy + 25 : null;
        const waitHigh = putBuy ? putBuy - 25 : null;

        let tradeSignal = "WAIT";
        if (callBuy !== null && putBuy !== null) {
            if (spot <= callBuy) tradeSignal = "CALL BUY";
            else if (spot >= putBuy) tradeSignal = "PUT BUY";
            else if (waitLow !== null && waitHigh !== null && spot > waitLow && spot < waitHigh)
                tradeSignal = "WAIT";
            else tradeSignal = pressureSide === "UPSIDE" ? "CALL BIAS" : "PUT BIAS";
        }

        const movementSpan = Math.abs((putBuy || spot) - (callBuy || spot));
        const distanceToTarget =
            tradeSignal === "CALL BUY"
                ? Math.abs(spot - (callBuy ?? spot))
                : tradeSignal === "PUT BUY"
                ? Math.abs((putBuy ?? spot) - spot)
                : movementSpan / 2;

        const etaMin = Math.max(5, Math.round(distanceToTarget / 8));
        const etaText = `${etaMin}-${etaMin + 5} min`;

        const tableRows = liveData.map((row, index) => {
            const strike = safe(row.strikePrice);
            const ceOI = safe((row.CE as any)?.openInterest);
            const peOI = safe((row.PE as any)?.openInterest);
            const ceChg = safe((row.CE as any)?.changeinOpenInterest);
            const peChg = safe((row.PE as any)?.changeinOpenInterest);
            const ceVol = safe((row.CE as any)?.totalTradedVolume);
            const peVol = safe((row.PE as any)?.totalTradedVolume);

            const reversalLevel = reversalMap[strike];
            const isRoundInRange = reversalLevel !== undefined;
            const isATM = Math.abs(strike - spot) <= 50;

            let rowBg = "#111827";
            if (isRoundInRange && reversalLevel < strike) rowBg = "#3b0a0a";
            else if (isRoundInRange && reversalLevel > strike) rowBg = "#0b2e13";
            else if (isATM) rowBg = "#4a3b00";

            return (
                <tr key={index} style={{ backgroundColor: rowBg, color: "#fff" }}>
                    <td>{L(ceOI)}</td>
                    <td>{L(ceChg)}</td>
                    <td>{(row.CE as any)?.lastPrice ?? "-"}</td>
                    <td>{L(ceVol)}</td>

                    <td style={{ textAlign: "center", minWidth: "180px" }}>
                        <div>{strike}</div>
                        {isRoundInRange && (
                            <div
                                style={{
                                    marginTop: "4px",
                                    fontSize: "10px",
                                    color: reversalLevel < strike ? "#fca5a5" : "#86efac",
                                }}
                            >
                                Reverse ≈ {reversalLevel}
                            </div>
                        )}
                    </td>

                    <td>{L(peVol)}</td>
                    <td>{(row.PE as any)?.lastPrice ?? "-"}</td>
                    <td>{L(peChg)}</td>
                    <td>{L(peOI)}</td>
                </tr>
            );
        });

        return {
            tableRows,
            pressureSide,
            callBuy,
            putBuy,
            waitLow,
            waitHigh,
            tradeSignal,
            etaText,
        };
    }, [liveData]);

    if (loading && !liveData.length) return <p>Loading option chain...</p>;
    if (!liveData.length) return <p>No option chain data found.</p>;

    return (
        <div style={{ overflowX: "auto" }}>
            <div
                style={{
                    color: "#94a3b8",
                    fontSize: "11px",
                    marginBottom: "8px",
                    textAlign: "right",
                }}
            >
                Auto Updated: {lastUpdated.toLocaleTimeString()}
            </div>

            <div
                style={{
                    marginBottom: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#fff",
                    lineHeight: "1.8",
                    fontSize: "13px",
                    fontWeight: "bold",
                }}
            >
                <div>Pressure: {pressureSide}</div>
                <div style={{ color: "#86efac" }}>CALL BUY: {callBuy ?? "-"}</div>
                <div style={{ color: "#fca5a5" }}>PUT BUY: {putBuy ?? "-"}</div>
                <div style={{ color: "#fbbf24" }}>
                    WAIT: {waitLow ?? "-"} - {waitHigh ?? "-"}
                </div>
                <div>Signal: {tradeSignal}</div>
                <div>Expected Move Time: {etaText}</div>
            </div>

            <table
                border={1}
                cellPadding={8}
                cellSpacing={0}
                style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}
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
                <tbody>{tableRows}</tbody>
            </table>
        </div>
    );
};

export default OptionChainTable;
