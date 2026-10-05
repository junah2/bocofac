# Linear Model (Predictive Analytics)

Everything about the BOCOFAC sales forecast is in this folder: how the model was trained, the trained
model itself, the code that makes predictions, and the dashboard that shows them.

**Model:** Simple Linear Regression, `Y = a + bX`, where X is the year, month number, or week number. It is
trained for two things:

- **Product performance:** Y = total sales (₱)
- **Customer purchase pattern:** Y = number of orders

## 1. Training (`training/`)

Open the notebooks in Jupyter or Google Colab and run them in order. They only contain code.

| File | What it does |
|---|---|
| `01_train_linear_regression.ipynb` | Reads the sales history, builds the yearly, monthly, and weekly tables (total sales and number of orders), and trains the six regressions with `statsmodels.OLS` (2 measures × 3 levels). It shows each model's constant, slope, R, R², F, and p-value, then saves them to `trained_model.json`. |
| `02_forecast_and_accuracy.ipynb` | Loads `trained_model.json` and forecasts the next periods (2027, Sep 2026 onward, and the week of Sep 7, 2026 onward) for sales and orders. It then checks accuracy three ways: a holdout test (last 6 months or weeks), a rolling monthly test, and the fit on all complete periods (MAPE and accuracy %). |
| `trained_model.json` | The trained model: the constant (a) and slope (b) of all six regressions, with their statistics. |
| `data/sales_history.csv` | The training data: 2,484 sales, ₱2,111,386, Nov 1 2021 – Aug 31 2026. |
| `data/yearly.csv`, `monthly.csv`, `weekly.csv` | The period tables made by notebook 01 (X, total sales, number of orders). |

The results match the statistician's (for example, the 2027 sales forecast is ₱452,190.27, and the
Sep 2026 forecast is ₱35,709.50 and 42.85 orders).

## 2. Trained model (`model.js`)

The product performance (sales) coefficients from `training/trained_model.json` that the dashboard uses,
plus the results table of all six regressions (R, R², p-value) and the date range of the training data.
After retraining, copy the new constants and slopes from `trained_model.json` into this file.

## 3. Prediction code

| File | What it does |
|---|---|
| `forecast.js` | Builds the weekly, monthly, and yearly sales history from the orders; predicts with the model's equation (`linearModelForecast`, `weeklyModelForecast`, `yearlyModelForecast`); and tests accuracy with its own least-squares regression (`linearRegression`, `backtestLinearMape`). |
| `productPerformance.js` | Splits the projected sales into each product's expected demand, based on the product's share of past sales. It also sets the demand level (High, Moderate, or Low) and the restock status. This is an allocation, not a separate model per product. |

## 4. Dashboard

| File | What it shows |
|---|---|
| `SalesForecast.jsx` | The Analytics page: projected sales, previous period, expected change, the sales trend chart, and the suggestions. |
| `ProductForecast.jsx` | The Product Performance Forecast: summary cards, the prediction table, the demand chart, top products, and Actual vs Predicted. |
