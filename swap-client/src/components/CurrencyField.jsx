import React from 'react';

const CurrencyField = props => {
    const getPrice = (value) => {
        props.getSwapPrice(value)
    }

    return (
        <div className="row currencyInput">
            <div className="col-md-6 numberContainer">
                {props.loading ? (
                    <div className="spinnerContainer">
                        <props.spinner />
                    </div>
                ) : (
                    <input
                        className="currencyInputField"
                        placeholder="0.0"
                        value={props.value}
                        onBlur={e => props.field === "input" ? getPrice(e.target.value) : null}
                        onChange={e => getPrice(e.target.value)}
                    />
                )}
            </div>
            <div className="col-md-6 tokenContainer">
                <span className="tokenSymbol">{props.tokenName}</span>
                <div className="balanceContainer">
                    <span className="balanceAmount">Balance: {props.balance?.toFixed(3)}</span>
                </div>
            </div>
        </div>
    )
}

export default CurrencyField;