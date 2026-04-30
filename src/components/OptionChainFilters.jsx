import React from "react";

const OptionChainFilters = ({
    filters,
    expiryDates,
    typeOptions,
    symbolOptions,
    onTypeChange,
    onSymbolChange,
    onExpiryChange,
    onRefresh,
}) => {
    return (
        <div
            style={{
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
                flexWrap: "wrap",
            }}
        >
            <div>
                <label>Type</label>
                <br />
                <select value={filters.type} onChange={onTypeChange}>
                    {typeOptions.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label>Symbol</label>
                <br />
                <select value={filters.symbol} onChange={onSymbolChange}>
                    {symbolOptions[filters.type].map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label>Expiry</label>
                <br />
                <select value={filters.expiry} onChange={onExpiryChange}>
                    {expiryDates.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ alignSelf: "end" }}>
                <button onClick={onRefresh}>Refresh</button>
            </div>
        </div>
    );
};

export default OptionChainFilters;