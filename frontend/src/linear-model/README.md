# Linear Model (Predictive Analytics)

Everything about the BOCOFAC sales forecast is in this folder: how the model was trained, the trained
model itself, the code that makes predictions, and the dashboard that shows them.

**Model:** Simple Linear Regression, `Sales = a + b × time`, where time is the week, month, or year number.

## 1. Training (`training/`)

| File | What it is |
|---|---|
| `BOCOFAC_Product_Performance_Regression.ipynb` | The statistician's Google Colab notebook. It reads the sales history (Nov 2021 – Aug 2026), groups it by year, month, and week, and fits the regression with `statsmodels.OLS`. It also outputs R², p-value, slope, constant, and the predictions. |
| `data/00_sales_history_raw.csv` | The sales history used for training (2,484 sales, ₱2,111,386). |
| `data/01_monthly_sales.csv`, `02_monthly_units_by_product.csv` | Sales per month, and units sold per product per month. |
| `data/03_holdout_test_results.csv` | Holdout test: each model is trained on all but the last 6 months, then predicts those 6 months. |
| `data/04_rolling_backtest_detail.csv` | Rolling test: every month is predicted from the months before it (78 tests). |
| `data/05_model_accuracy_summary.csv` | Accuracy of the 5 models compared (Naive, 12-month Moving Average, Exponential Smoothing, Linear Regression, Classical Decomposition). |
| `data/06_autocorrelation.csv` | Autocorrelation check of the monthly sales. |

The notebook needs `BOCOFAC_SALES_DATA_2026_FINAL.xlsx`, which is kept outside the repository.

## 2. Trained model (`model.js`)

The result of training: the constant (a) and slope (b) of the weekly, monthly, and yearly regressions, the
statistician's results table (R, R², p-value), and the date range of the training data. To use a newly
trained model, update the numbers in this file.

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
