#!/usr/bin/env python3
"""Synthetic financial data generator for Crestview Freight Solutions.

Usage:
    python3 scripts/generate_synthetic_data.py [OPTIONS]

Options:
    --tables TABLE [TABLE ...]   Tables to generate (default: all)
    --scale FLOAT                Row multiplier, e.g. 0.1 for 10% (default: 1.0)
    --start-date YYYY-MM-DD      (default: 2024-01-01)
    --end-date   YYYY-MM-DD      (default: 2025-06-30)
    --seed INT                   RNG seed (default: 20240101)
    --output-dir PATH            (default: <repo>/output/data)
    --yes                        Skip confirmation prompt
"""

import argparse
import csv
import json
import math
import os
import random
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, date, timedelta

import numpy as np
from faker import Faker

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_SEED = 20240101
DEFAULT_START = date(2024, 1, 1)
DEFAULT_END = date(2025, 6, 30)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUTPUT_DIR = os.path.join(REPO_ROOT, "output", "data")

ALL_TABLES = [
    "dim_vendor",
    "dim_chart_of_accounts",
    "dim_department",
    "dim_location",
    "dim_employee",
    "fact_bill",
    "fact_bill_line_item",
    "fact_bill_payment",
    "fact_bill_payment_allocation",
    "fact_vendor_credit",
    "fact_expense_report",
    "fact_expense_transaction",
    "fact_card_transaction",
    "fact_freight_invoice",
    "fact_purchase_order",
    "fact_po_receipt",
    "bridge_po_bill_match",
    "bridge_bill_approval_log",
]

BASE_TARGETS = {
    "dim_vendor": 800,
    "dim_chart_of_accounts": 150,
    "dim_department": 40,
    "dim_location": 25,
    "dim_employee": 120,
    "fact_bill": 18_000,
    "fact_bill_line_item": 72_000,
    "fact_bill_payment": 14_000,
    "fact_bill_payment_allocation": 18_500,
    "fact_vendor_credit": 900,
    "fact_expense_report": 2_200,
    "fact_expense_transaction": 13_000,
    "fact_card_transaction": 9_500,
    "fact_freight_invoice": 22_000,
    "fact_purchase_order": 7_500,
    "fact_po_receipt": 7_200,
    "bridge_po_bill_match": 15_000,
    "bridge_bill_approval_log": 48_000,
}

# Bill.com paymentStatus codes
PAY_STATUS_OPEN = "0"
PAY_STATUS_SCHEDULED = "1"
PAY_STATUS_PAID = "4"
PAY_STATUS_PARTIAL = "5"

# Bill.com approvalStatus codes
APPR_UNASSIGNED = "0"
APPR_ASSIGNED = "1"
APPR_APPROVING = "4"
APPR_APPROVED = "8"
APPR_DENIED = "9"

US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

FREIGHT_CATEGORIES = [
    "Freight Carrier", "Freight Carrier", "Freight Carrier",
    "Fuel & Fleet", "Fuel & Fleet",
    "Staffing", "Staffing",
    "Warehouse", "Equipment",
    "Professional Services", "IT & Technology",
    "Insurance", "Utilities", "Office Supplies",
]

MERCHANT_CATEGORIES = [
    "Fuel", "Freight", "Lodging", "Meals", "Office Supplies",
    "Equipment Rental", "Tolls", "Parking", "Repair & Maintenance",
    "Telecommunications",
]

PAYMENT_TERMS = [15, 30, 60]

# ---------------------------------------------------------------------------
# Global state (populated by dim generators, consumed by fact generators)
# ---------------------------------------------------------------------------

fake = Faker()
rng = np.random.default_rng(DEFAULT_SEED)

output_dir: str = DEFAULT_OUTPUT_DIR
table_stats: dict = {}  # table -> row_count

# Pre-computed date sampling
_date_pool: list = []
_date_weights: np.ndarray = None


def _build_date_pool(start: date, end: date):
    global _date_pool, _date_weights
    d = start
    pool = []
    weights = []
    while d <= end:
        w = 1.0
        if d.month in (10, 11, 12):
            w *= 1.2
        if d.month == 1:
            w *= 0.9
        pool.append(d)
        weights.append(w)
        d += timedelta(days=1)
    arr = np.array(weights, dtype=float)
    arr /= arr.sum()
    _date_pool = pool
    _date_weights = arr


def rand_date() -> date:
    idx = rng.choice(len(_date_pool), p=_date_weights)
    return _date_pool[idx]


def rand_ts(d: date) -> str:
    h = random.randint(0, 23)
    m = random.randint(0, 59)
    s = random.randint(0, 59)
    return f"{d.isoformat()}T{h:02d}:{m:02d}:{s:02d}Z"


def uid() -> str:
    return str(uuid.uuid4())


def fmt_amount(v: float) -> str:
    return f"{v:.2f}"


def log_progress(table: str, row_num: int):
    if row_num % 1000 == 0 and row_num > 0:
        print(f"  [{table}] {row_num:,} rows written", flush=True)


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

@contextmanager
def open_csv_writer(table_name: str, fieldnames: list):
    path = os.path.join(output_dir, f"{table_name}.csv")
    f = open(path, "w", newline="", encoding="utf-8")
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    count = [0]
    try:
        yield writer, count
    finally:
        f.close()
        table_stats[table_name] = count[0]
        print(f"  [{table_name}] done — {count[0]:,} rows", flush=True)


# ---------------------------------------------------------------------------
# Dimension generators
# ---------------------------------------------------------------------------

def generate_dim_vendor(n: int) -> tuple:
    """Returns (vendor_ids, vendor_weights, vendor_gl_map)."""
    fields = [
        "id", "name", "shortName", "nameOnCheck", "accountType",
        "address1", "address2", "city", "state", "zip", "country",
        "phone", "email", "taxId", "track1099", "paymentTermId",
        "defaultGLAccountId", "isActive", "createdTime", "updatedTime",
    ]
    ids = [uid() for _ in range(n)]
    # Pareto weights so top ~20 vendors ≈ 60% of spend
    raw = rng.pareto(1.5, size=n) + 1.0
    weights = raw / raw.sum()

    with open_csv_writer("dim_vendor", fields) as (w, count):
        for i, vid in enumerate(ids):
            created = rand_date() - timedelta(days=random.randint(180, 1800))
            updated = created + timedelta(days=random.randint(0, 180))
            terms_id = str(random.choice(PAYMENT_TERMS))
            row = {
                "id": vid,
                "name": fake.company(),
                "shortName": fake.company_suffix(),
                "nameOnCheck": fake.company(),
                "accountType": "AP",
                "address1": fake.street_address(),
                "address2": "" if random.random() > 0.2 else f"Suite {random.randint(100,999)}",
                "city": fake.city(),
                "state": random.choice(US_STATES),
                "zip": fake.zipcode(),
                "country": "US",
                "phone": fake.phone_number(),
                "email": fake.company_email(),
                "taxId": f"{random.randint(10,99)}-{random.randint(1000000,9999999)}",
                "track1099": str(random.random() < 0.3).lower(),
                "paymentTermId": terms_id,
                "defaultGLAccountId": "",  # filled after GL generated
                "isActive": str(random.random() > 0.05).lower(),
                "createdTime": rand_ts(created),
                "updatedTime": rand_ts(updated),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("dim_vendor", count[0])

    return ids, weights


def generate_dim_chart_of_accounts(n: int = 150) -> dict:
    """Returns dict: type -> [gl_ids]."""
    fields = ["id", "name", "accountNumber", "description", "type", "createdTime", "updatedTime"]
    type_counts = {
        "Expense": 80,
        "Asset": 20,
        "Liability": 20,
        "Revenue": 15,
        "Equity": 15,
    }
    gl_by_type: dict = {t: [] for t in type_counts}
    acct_num = 1000

    with open_csv_writer("dim_chart_of_accounts", fields) as (w, count):
        for acct_type, cnt in type_counts.items():
            for _ in range(cnt):
                gid = uid()
                gl_by_type[acct_type].append(gid)
                created = rand_date() - timedelta(days=random.randint(365, 2000))
                row = {
                    "id": gid,
                    "name": f"{acct_type} - {fake.bs().title()}",
                    "accountNumber": str(acct_num),
                    "description": fake.sentence(nb_words=6),
                    "type": acct_type,
                    "createdTime": rand_ts(created),
                    "updatedTime": rand_ts(created + timedelta(days=random.randint(0, 90))),
                }
                w.writerow(row)
                count[0] += 1
                acct_num += random.randint(5, 50)

    return gl_by_type


def generate_dim_department(n: int = 40) -> list:
    fields = ["id", "name", "shortName", "parentDepartmentId", "isActive", "createdTime", "updatedTime"]
    ids = [uid() for _ in range(n)]
    parent_pool = ids[:5]  # first 5 are top-level

    with open_csv_writer("dim_department", fields) as (w, count):
        for i, did in enumerate(ids):
            created = rand_date() - timedelta(days=random.randint(180, 1800))
            parent = "" if i < 5 else random.choice(parent_pool)
            row = {
                "id": did,
                "name": fake.bs().title(),
                "shortName": fake.lexify("???").upper(),
                "parentDepartmentId": parent,
                "isActive": "true",
                "createdTime": rand_ts(created),
                "updatedTime": rand_ts(created + timedelta(days=random.randint(0, 90))),
            }
            w.writerow(row)
            count[0] += 1

    return ids


def generate_dim_location(n: int = 25) -> list:
    fields = [
        "id", "name", "shortName", "address1", "city", "state", "zip",
        "locationType", "isWarehouse", "isActive", "createdTime", "updatedTime",
    ]
    ids = [uid() for _ in range(n)]
    loc_types = ["HQ", "Warehouse", "Distribution Center", "Terminal", "Office"]

    with open_csv_writer("dim_location", fields) as (w, count):
        for lid in ids:
            created = rand_date() - timedelta(days=random.randint(180, 1800))
            lt = random.choice(loc_types)
            row = {
                "id": lid,
                "name": f"{fake.city()} {lt}",
                "shortName": fake.lexify("??-??").upper(),
                "address1": fake.street_address(),
                "city": fake.city(),
                "state": random.choice(US_STATES),
                "zip": fake.zipcode(),
                "locationType": lt,
                "isWarehouse": str(lt in ("Warehouse", "Distribution Center")).lower(),
                "isActive": "true",
                "createdTime": rand_ts(created),
                "updatedTime": rand_ts(created + timedelta(days=random.randint(0, 90))),
            }
            w.writerow(row)
            count[0] += 1

    return ids


def generate_dim_employee(n: int, dept_ids: list, loc_ids: list) -> tuple:
    """Returns (emp_ids, emp_dept_map, emp_loc_map)."""
    fields = [
        "id", "firstName", "lastName", "email", "departmentId", "locationId",
        "managerId", "isActive", "createdTime", "updatedTime",
    ]
    ids = [uid() for _ in range(n)]
    emp_dept = {}
    emp_loc = {}
    manager_pool = ids[:10]

    with open_csv_writer("dim_employee", fields) as (w, count):
        for i, eid in enumerate(ids):
            created = rand_date() - timedelta(days=random.randint(90, 1800))
            dept = random.choice(dept_ids)
            loc = random.choice(loc_ids)
            emp_dept[eid] = dept
            emp_loc[eid] = loc
            manager = "" if i < 5 else random.choice(manager_pool)
            row = {
                "id": eid,
                "firstName": fake.first_name(),
                "lastName": fake.last_name(),
                "email": fake.company_email(),
                "departmentId": dept,
                "locationId": loc,
                "managerId": manager,
                "isActive": str(random.random() > 0.05).lower(),
                "createdTime": rand_ts(created),
                "updatedTime": rand_ts(created + timedelta(days=random.randint(0, 90))),
            }
            w.writerow(row)
            count[0] += 1

    return ids, emp_dept, emp_loc


# ---------------------------------------------------------------------------
# Fact generators
# ---------------------------------------------------------------------------

def _bill_amount() -> float:
    v = float(np.exp(rng.normal(8.5, 1.5)))
    return round(min(max(v, 50.0), 500_000.0), 2)


def _freight_amount() -> float:
    v = float(np.exp(rng.normal(6.8, 0.9)))
    return round(min(max(v, 50.0), 20_000.0), 2)


def _split_amount(total: float, n: int) -> list:
    if n == 1:
        return [round(total, 2)]
    cuts = sorted(random.uniform(0.01 * total, 0.99 * total) for _ in range(n - 1))
    parts = [cuts[0]] + [cuts[i + 1] - cuts[i] for i in range(len(cuts) - 1)] + [total - cuts[-1]]
    rounded = [round(p, 2) for p in parts]
    # fix rounding drift on last element
    diff = round(total - sum(rounded), 2)
    rounded[-1] = round(rounded[-1] + diff, 2)
    return rounded


def generate_fact_bill(
    n: int,
    vendor_ids: list,
    vendor_weights: np.ndarray,
    dept_ids: list,
    loc_ids: list,
) -> list:
    """Returns list of lightweight bill_records dicts."""
    fields = [
        "id", "vendorId", "invoiceNumber", "invoiceDate", "dueDate",
        "glPostingDate", "departmentId", "locationId", "description",
        "poNumber", "paymentTermId", "billAmount", "dueAmount",
        "paymentStatus", "approvalStatus", "createdTime", "updatedTime",
    ]
    pay_statuses = [PAY_STATUS_PAID] * 70 + [PAY_STATUS_OPEN] * 15 + \
                   [PAY_STATUS_PARTIAL] * 10 + [PAY_STATUS_SCHEDULED] * 5

    bill_records = []

    with open_csv_writer("fact_bill", fields) as (w, count):
        for _ in range(n):
            bid = uid()
            inv_date = rand_date()
            terms = random.choice(PAYMENT_TERMS)
            due = inv_date + timedelta(days=terms)
            amount = _bill_amount()
            pay_status = random.choice(pay_statuses)

            if pay_status == PAY_STATUS_PAID:
                due_amount = 0.0
                appr_status = APPR_APPROVED
            elif pay_status == PAY_STATUS_PARTIAL:
                due_amount = round(amount * random.uniform(0.1, 0.9), 2)
                appr_status = APPR_APPROVED
            elif pay_status == PAY_STATUS_SCHEDULED:
                due_amount = amount
                appr_status = APPR_APPROVED
            else:
                due_amount = amount
                appr_status = random.choice([APPR_UNASSIGNED, APPR_ASSIGNED, APPR_APPROVING])

            # 85% have PO reference
            has_po = random.random() < 0.85
            po_num = f"PO-{random.randint(10000, 99999)}" if has_po else ""

            row = {
                "id": bid,
                "vendorId": str(rng.choice(vendor_ids, p=vendor_weights)),
                "invoiceNumber": f"INV-{random.randint(100000, 999999)}",
                "invoiceDate": inv_date.isoformat(),
                "dueDate": due.isoformat(),
                "glPostingDate": inv_date.isoformat(),
                "departmentId": random.choice(dept_ids),
                "locationId": random.choice(loc_ids),
                "description": fake.sentence(nb_words=8),
                "poNumber": po_num,
                "paymentTermId": str(terms),
                "billAmount": fmt_amount(amount),
                "dueAmount": fmt_amount(due_amount),
                "paymentStatus": pay_status,
                "approvalStatus": appr_status,
                "createdTime": rand_ts(inv_date),
                "updatedTime": rand_ts(inv_date + timedelta(days=random.randint(0, 5))),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_bill", count[0])

            bill_records.append({
                "id": bid,
                "vendorId": row["vendorId"],
                "invoiceDate": inv_date,
                "dueDate": due,
                "amount": amount,
                "dueAmount": due_amount,
                "paymentStatus": pay_status,
                "approvalStatus": appr_status,
                "has_po": has_po,
                "departmentId": row["departmentId"],
                "locationId": row["locationId"],
            })

    return bill_records


def generate_fact_bill_line_item(
    n_target: int,
    bill_records: list,
    gl_ids: list,
    dept_ids: list,
    loc_ids: list,
):
    fields = [
        "id", "billId", "glAccountId", "departmentId", "locationId",
        "description", "quantity", "unitPrice", "amount",
        "taxable", "createdTime", "updatedTime",
    ]
    with open_csv_writer("fact_bill_line_item", fields) as (w, count):
        for bill in bill_records:
            n_lines = random.randint(3, 6)
            amounts = _split_amount(bill["amount"], n_lines)
            for amt in amounts:
                qty = random.randint(1, 20)
                unit = round(amt / qty, 4)
                row = {
                    "id": uid(),
                    "billId": bill["id"],
                    "glAccountId": random.choice(gl_ids),
                    "departmentId": bill["departmentId"],
                    "locationId": bill["locationId"],
                    "description": fake.sentence(nb_words=5),
                    "quantity": qty,
                    "unitPrice": fmt_amount(unit),
                    "amount": fmt_amount(amt),
                    "taxable": str(random.random() < 0.3).lower(),
                    "createdTime": rand_ts(bill["invoiceDate"]),
                    "updatedTime": rand_ts(bill["invoiceDate"]),
                }
                w.writerow(row)
                count[0] += 1
                log_progress("fact_bill_line_item", count[0])


def generate_fact_bill_payment(bill_records: list) -> list:
    """Generates one payment per paid/partial bill. Returns payment_records."""
    fields = [
        "id", "vendorId", "paymentDate", "amount", "paymentType",
        "status", "memo", "processDate", "bankAccountId", "createdTime", "updatedTime",
    ]
    payment_types = ["Printed Check", "ACH", "ACH", "ACH", "Virtual Card", "International Wire"]
    bank_ids = [uid(), uid(), uid()]  # 3 Crestview bank accounts

    payable = [b for b in bill_records if b["paymentStatus"] in (PAY_STATUS_PAID, PAY_STATUS_PARTIAL)]
    payment_records = []

    with open_csv_writer("fact_bill_payment", fields) as (w, count):
        for bill in payable:
            pid = uid()
            pay_date = bill["dueDate"] + timedelta(days=random.randint(-3, 20))
            if pay_date < bill["dueDate"]:
                pay_date = bill["dueDate"]
            paid_amount = bill["amount"] if bill["paymentStatus"] == PAY_STATUS_PAID else \
                          round(bill["amount"] - bill["dueAmount"], 2)
            row = {
                "id": pid,
                "vendorId": bill["vendorId"],
                "paymentDate": pay_date.isoformat(),
                "amount": fmt_amount(paid_amount),
                "paymentType": random.choice(payment_types),
                "status": "Processed",
                "memo": fake.sentence(nb_words=5),
                "processDate": (pay_date + timedelta(days=random.randint(0, 2))).isoformat(),
                "bankAccountId": random.choice(bank_ids),
                "createdTime": rand_ts(pay_date),
                "updatedTime": rand_ts(pay_date),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_bill_payment", count[0])
            payment_records.append({
                "id": pid,
                "billId": bill["id"],
                "amount": paid_amount,
                "paymentDate": pay_date,
            })

    return payment_records


def generate_fact_bill_payment_allocation(payment_records: list, bill_records: list):
    fields = ["id", "billPaymentId", "billId", "amount", "createdTime"]
    bill_by_id = {b["id"]: b for b in bill_records}
    unpaid_bill_ids = [
        b["id"] for b in bill_records
        if b["paymentStatus"] == PAY_STATUS_OPEN
    ]

    with open_csv_writer("fact_bill_payment_allocation", fields) as (w, count):
        for pmt in payment_records:
            # ~15% chance this payment covers extra bills
            if unpaid_bill_ids and random.random() < 0.15:
                extra_n = random.randint(1, 3)
                extra_ids = random.sample(unpaid_bill_ids, min(extra_n, len(unpaid_bill_ids)))
                all_bill_ids = [pmt["billId"]] + extra_ids
                amounts = _split_amount(pmt["amount"], len(all_bill_ids))
            else:
                all_bill_ids = [pmt["billId"]]
                amounts = [pmt["amount"]]

            for bid, amt in zip(all_bill_ids, amounts):
                bill = bill_by_id.get(bid, {})
                created_date = pmt["paymentDate"]
                row = {
                    "id": uid(),
                    "billPaymentId": pmt["id"],
                    "billId": bid,
                    "amount": fmt_amount(amt),
                    "createdTime": rand_ts(created_date),
                }
                w.writerow(row)
                count[0] += 1
                log_progress("fact_bill_payment_allocation", count[0])


def generate_fact_vendor_credit(n: int, vendor_ids: list, gl_ids: list, dept_ids: list):
    fields = [
        "id", "vendorId", "creditDate", "glAccountId", "departmentId",
        "amount", "appliedAmount", "remainingAmount", "status",
        "description", "createdTime", "updatedTime",
    ]
    with open_csv_writer("fact_vendor_credit", fields) as (w, count):
        for _ in range(n):
            cid = uid()
            credit_date = rand_date()
            total = round(random.uniform(100, 5000), 2)
            applied = round(total * random.uniform(0, 1), 2)
            remaining = round(total - applied, 2)
            status = "Applied" if remaining == 0 else ("PartiallyApplied" if applied > 0 else "Open")
            row = {
                "id": cid,
                "vendorId": random.choice(vendor_ids),
                "creditDate": credit_date.isoformat(),
                "glAccountId": random.choice(gl_ids),
                "departmentId": random.choice(dept_ids),
                "amount": fmt_amount(total),
                "appliedAmount": fmt_amount(applied),
                "remainingAmount": fmt_amount(remaining),
                "status": status,
                "description": fake.sentence(nb_words=6),
                "createdTime": rand_ts(credit_date),
                "updatedTime": rand_ts(credit_date + timedelta(days=random.randint(0, 30))),
            }
            w.writerow(row)
            count[0] += 1


def generate_fact_expense_report(n: int, emp_ids: list) -> list:
    fields = [
        "id", "employeeId", "title", "submittedDate", "approvedDate",
        "totalAmount", "reimbursableAmount", "status", "approvalStatus",
        "createdTime", "updatedTime",
    ]
    statuses = ["Draft", "Submitted", "Approved", "Reimbursed", "Rejected"]
    report_records = []

    with open_csv_writer("fact_expense_report", fields) as (w, count):
        for _ in range(n):
            rid = uid()
            submitted = rand_date()
            total = round(random.uniform(50, 5000), 2)
            reimb = round(total * random.uniform(0.5, 1.0), 2)
            status = random.choice(statuses)
            approved_date = "" if status in ("Draft", "Submitted", "Rejected") else \
                            (submitted + timedelta(days=random.randint(1, 10))).isoformat()
            row = {
                "id": rid,
                "employeeId": random.choice(emp_ids),
                "title": f"Expense Report - {submitted.strftime('%B %Y')}",
                "submittedDate": submitted.isoformat(),
                "approvedDate": approved_date,
                "totalAmount": fmt_amount(total),
                "reimbursableAmount": fmt_amount(reimb),
                "status": status,
                "approvalStatus": APPR_APPROVED if status in ("Approved", "Reimbursed") else APPR_ASSIGNED,
                "createdTime": rand_ts(submitted),
                "updatedTime": rand_ts(submitted + timedelta(days=random.randint(0, 14))),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_expense_report", count[0])
            report_records.append({"id": rid, "employeeId": row["employeeId"], "submittedDate": submitted})

    return report_records


def generate_fact_expense_transaction(
    n: int,
    report_records: list,
    emp_ids: list,
    gl_ids: list,
    dept_ids: list,
    loc_ids: list,
):
    fields = [
        "id", "expenseReportId", "employeeId", "transactionDate", "glAccountId",
        "departmentId", "locationId", "vendorName", "amount", "reimbursable",
        "billable", "description", "receiptStatus", "createdTime", "updatedTime",
    ]
    receipt_statuses = ["Missing", "Attached", "Attached", "Attached", "Waived"]

    with open_csv_writer("fact_expense_transaction", fields) as (w, count):
        for _ in range(n):
            report = random.choice(report_records)
            txn_date = report["submittedDate"] - timedelta(days=random.randint(0, 30))
            row = {
                "id": uid(),
                "expenseReportId": report["id"],
                "employeeId": report["employeeId"],
                "transactionDate": txn_date.isoformat(),
                "glAccountId": random.choice(gl_ids),
                "departmentId": random.choice(dept_ids),
                "locationId": random.choice(loc_ids),
                "vendorName": fake.company(),
                "amount": fmt_amount(round(random.uniform(5, 1500), 2)),
                "reimbursable": str(random.random() > 0.2).lower(),
                "billable": str(random.random() < 0.3).lower(),
                "description": fake.sentence(nb_words=6),
                "receiptStatus": random.choice(receipt_statuses),
                "createdTime": rand_ts(txn_date),
                "updatedTime": rand_ts(txn_date),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_expense_transaction", count[0])


def generate_fact_card_transaction(
    n: int,
    emp_ids: list,
    gl_ids: list,
    dept_ids: list,
    report_ids: list,
):
    fields = [
        "id", "employeeId", "cardId", "merchantName", "merchantCategory",
        "transactionDate", "settledDate", "amount", "glAccountId", "departmentId",
        "expenseReportId", "status", "createdTime", "updatedTime",
    ]
    card_ids = [uid() for _ in range(max(1, len(emp_ids) // 3))]
    statuses = ["Pending", "Settled", "Settled", "Settled", "Disputed"]

    with open_csv_writer("fact_card_transaction", fields) as (w, count):
        for _ in range(n):
            txn_date = rand_date()
            settled = txn_date + timedelta(days=random.randint(1, 3))
            row = {
                "id": uid(),
                "employeeId": random.choice(emp_ids),
                "cardId": random.choice(card_ids),
                "merchantName": fake.company(),
                "merchantCategory": random.choice(MERCHANT_CATEGORIES),
                "transactionDate": txn_date.isoformat(),
                "settledDate": settled.isoformat(),
                "amount": fmt_amount(round(random.uniform(5, 2000), 2)),
                "glAccountId": random.choice(gl_ids),
                "departmentId": random.choice(dept_ids),
                "expenseReportId": random.choice(report_ids) if random.random() < 0.6 else "",
                "status": random.choice(statuses),
                "createdTime": rand_ts(txn_date),
                "updatedTime": rand_ts(settled),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_card_transaction", count[0])


def generate_fact_freight_invoice(
    n: int,
    vendor_ids: list,
    loc_ids: list,
    gl_ids: list,
):
    fields = [
        "id", "carrierId", "invoiceNumber", "invoiceDate", "dueDate",
        "shipmentId", "originLocationId", "destinationLocationId",
        "freightMode", "weight", "billableWeight", "baseCharge",
        "fuelSurcharge", "accessorialCharges", "totalAmount",
        "paymentStatus", "glAccountId", "createdTime", "updatedTime",
    ]
    mode_pool = (
        ["LTL"] * 60 + ["FTL"] * 20 + ["Parcel"] * 10 +
        ["Air"] * 4 + ["Ocean"] * 4 + ["Rail"] * 2
    )
    pay_pool = [PAY_STATUS_PAID] * 70 + [PAY_STATUS_OPEN] * 20 + \
               [PAY_STATUS_PARTIAL] * 10

    with open_csv_writer("fact_freight_invoice", fields) as (w, count):
        for _ in range(n):
            inv_date = rand_date()
            terms = random.choice(PAYMENT_TERMS)
            due = inv_date + timedelta(days=terms)
            total = _freight_amount()
            base = round(total * random.uniform(0.6, 0.8), 2)
            fuel = round(total * random.uniform(0.05, 0.15), 2)
            accessorial = round(total - base - fuel, 2)
            if accessorial < 0:
                accessorial = 0.0
                base = round(total - fuel, 2)
            weight = round(random.uniform(50, 40000), 1)
            row = {
                "id": uid(),
                "carrierId": random.choice(vendor_ids),
                "invoiceNumber": f"FRT-{random.randint(100000, 999999)}",
                "invoiceDate": inv_date.isoformat(),
                "dueDate": due.isoformat(),
                "shipmentId": f"SHP-{random.randint(1000000, 9999999)}",
                "originLocationId": random.choice(loc_ids),
                "destinationLocationId": random.choice(loc_ids),
                "freightMode": random.choice(mode_pool),
                "weight": str(weight),
                "billableWeight": str(round(weight * random.uniform(1.0, 1.15), 1)),
                "baseCharge": fmt_amount(base),
                "fuelSurcharge": fmt_amount(fuel),
                "accessorialCharges": fmt_amount(accessorial),
                "totalAmount": fmt_amount(total),
                "paymentStatus": random.choice(pay_pool),
                "glAccountId": random.choice(gl_ids),
                "createdTime": rand_ts(inv_date),
                "updatedTime": rand_ts(inv_date + timedelta(days=random.randint(0, 5))),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_freight_invoice", count[0])


def generate_fact_purchase_order(
    n: int,
    vendor_ids: list,
    dept_ids: list,
    loc_ids: list,
    gl_ids: list,
    emp_ids: list,
) -> list:
    fields = [
        "id", "vendorId", "poNumber", "poDate", "expectedDeliveryDate",
        "departmentId", "locationId", "glAccountId", "description",
        "totalAmount", "status", "approvedById", "createdTime", "updatedTime",
    ]
    statuses = ["Draft", "Approved", "PartiallyReceived", "Received", "Closed", "Cancelled"]
    status_weights = [0.05, 0.20, 0.20, 0.30, 0.20, 0.05]
    po_records = []

    with open_csv_writer("fact_purchase_order", fields) as (w, count):
        for _ in range(n):
            po_id = uid()
            po_date = rand_date()
            expected = po_date + timedelta(days=random.randint(7, 45))
            amount = _bill_amount()
            status = rng.choice(statuses, p=status_weights)
            row = {
                "id": po_id,
                "vendorId": random.choice(vendor_ids),
                "poNumber": f"PO-{random.randint(10000, 99999)}",
                "poDate": po_date.isoformat(),
                "expectedDeliveryDate": expected.isoformat(),
                "departmentId": random.choice(dept_ids),
                "locationId": random.choice(loc_ids),
                "glAccountId": random.choice(gl_ids),
                "description": fake.sentence(nb_words=8),
                "totalAmount": fmt_amount(amount),
                "status": status,
                "approvedById": random.choice(emp_ids) if status != "Draft" else "",
                "createdTime": rand_ts(po_date),
                "updatedTime": rand_ts(po_date + timedelta(days=random.randint(0, 10))),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_purchase_order", count[0])
            po_records.append({
                "id": po_id,
                "poDate": po_date,
                "expectedDeliveryDate": expected,
                "locationId": row["locationId"],
                "totalAmount": amount,
                "status": status,
            })

    return po_records


def generate_fact_po_receipt(n: int, po_records: list, loc_ids: list, emp_ids: list):
    fields = [
        "id", "purchaseOrderId", "receiptDate", "locationId", "receivedById",
        "lineItemId", "quantityOrdered", "quantityReceived", "unitCost",
        "totalCost", "notes", "createdTime", "updatedTime",
    ]
    receivable = [p for p in po_records if p["status"] not in ("Draft", "Cancelled")]
    if not receivable:
        receivable = po_records

    with open_csv_writer("fact_po_receipt", fields) as (w, count):
        for _ in range(n):
            po = random.choice(receivable)
            # receipt_date between poDate and expectedDeliveryDate
            delta = (po["expectedDeliveryDate"] - po["poDate"]).days
            if delta < 1:
                delta = 1
            receipt_date = po["poDate"] + timedelta(days=random.randint(0, delta))
            qty_ordered = random.randint(1, 500)
            qty_received = random.randint(1, qty_ordered)
            unit_cost = round(po["totalAmount"] / max(qty_ordered, 1), 4)
            row = {
                "id": uid(),
                "purchaseOrderId": po["id"],
                "receiptDate": receipt_date.isoformat(),
                "locationId": po["locationId"],
                "receivedById": random.choice(emp_ids),
                "lineItemId": uid(),
                "quantityOrdered": qty_ordered,
                "quantityReceived": qty_received,
                "unitCost": fmt_amount(unit_cost),
                "totalCost": fmt_amount(round(qty_received * unit_cost, 2)),
                "notes": fake.sentence(nb_words=5) if random.random() < 0.3 else "",
                "createdTime": rand_ts(receipt_date),
                "updatedTime": rand_ts(receipt_date),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("fact_po_receipt", count[0])


def generate_bridge_po_bill_match(n: int, po_records: list, bill_records: list):
    fields = [
        "id", "purchaseOrderId", "poReceiptId", "billId", "billLineItemId",
        "matchStatus", "matchedAmount", "variance", "matchedDate", "createdTime",
    ]
    match_statuses = ["Matched", "Matched", "Matched", "PartialMatch", "Unmatched", "Exception"]
    billed_bills = [b for b in bill_records if b["has_po"]]
    if not billed_bills:
        billed_bills = bill_records

    with open_csv_writer("bridge_po_bill_match", fields) as (w, count):
        for _ in range(n):
            po = random.choice(po_records)
            bill = random.choice(billed_bills)
            matched_date = bill["invoiceDate"] + timedelta(days=random.randint(0, 5))
            matched_amount = round(bill["amount"] * random.uniform(0.8, 1.0), 2)
            variance = round(bill["amount"] - matched_amount, 2)
            row = {
                "id": uid(),
                "purchaseOrderId": po["id"],
                "poReceiptId": uid(),
                "billId": bill["id"],
                "billLineItemId": uid(),
                "matchStatus": random.choice(match_statuses),
                "matchedAmount": fmt_amount(matched_amount),
                "variance": fmt_amount(variance),
                "matchedDate": matched_date.isoformat(),
                "createdTime": rand_ts(matched_date),
            }
            w.writerow(row)
            count[0] += 1
            log_progress("bridge_po_bill_match", count[0])


def generate_bridge_bill_approval_log(bill_records: list, emp_ids: list):
    fields = [
        "id", "billId", "approverId", "action", "previousStatus",
        "newStatus", "comments", "actionDate", "createdTime",
    ]
    with open_csv_writer("bridge_bill_approval_log", fields) as (w, count):
        for bill in bill_records:
            n_events = random.randint(1, 3)
            action_date = bill["invoiceDate"]

            # Event 1: Assigned
            w.writerow({
                "id": uid(),
                "billId": bill["id"],
                "approverId": random.choice(emp_ids),
                "action": "Assigned",
                "previousStatus": APPR_UNASSIGNED,
                "newStatus": APPR_ASSIGNED,
                "comments": "",
                "actionDate": action_date.isoformat(),
                "createdTime": rand_ts(action_date),
            })
            count[0] += 1
            log_progress("bridge_bill_approval_log", count[0])

            if n_events >= 2:
                action_date = action_date + timedelta(days=random.randint(1, 3))
                w.writerow({
                    "id": uid(),
                    "billId": bill["id"],
                    "approverId": random.choice(emp_ids),
                    "action": "Approving",
                    "previousStatus": APPR_ASSIGNED,
                    "newStatus": APPR_APPROVING,
                    "comments": fake.sentence(nb_words=5) if random.random() < 0.4 else "",
                    "actionDate": action_date.isoformat(),
                    "createdTime": rand_ts(action_date),
                })
                count[0] += 1
                log_progress("bridge_bill_approval_log", count[0])

            if n_events == 3:
                action_date = action_date + timedelta(days=random.randint(1, 3))
                approved = random.random() < 0.95
                w.writerow({
                    "id": uid(),
                    "billId": bill["id"],
                    "approverId": random.choice(emp_ids),
                    "action": "Approved" if approved else "Denied",
                    "previousStatus": APPR_APPROVING,
                    "newStatus": APPR_APPROVED if approved else APPR_DENIED,
                    "comments": fake.sentence(nb_words=7) if random.random() < 0.5 else "",
                    "actionDate": action_date.isoformat(),
                    "createdTime": rand_ts(action_date),
                })
                count[0] += 1
                log_progress("bridge_bill_approval_log", count[0])


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def write_manifest(start: date, end: date):
    manifest = {}
    for table, rows in table_stats.items():
        manifest[table] = {
            "file": f"{table}.csv",
            "rows": rows,
            "date_range": {
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        }
    path = os.path.join(output_dir, "manifest.json")
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written to {path}")


# ---------------------------------------------------------------------------
# CLI / entry point
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Synthetic financial data generator for Crestview Freight Solutions."
    )
    p.add_argument(
        "--tables", nargs="+", default=ALL_TABLES,
        metavar="TABLE",
        help="Tables to generate (default: all). Dimension tables are always generated first.",
    )
    p.add_argument(
        "--scale", type=float, default=1.0,
        help="Row multiplier applied to all targets, e.g. 0.1 = 10%% (default: 1.0)",
    )
    p.add_argument("--start-date", default="2024-01-01", help="Start date YYYY-MM-DD")
    p.add_argument("--end-date", default="2025-06-30", help="End date YYYY-MM-DD")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED, help="RNG seed (default: 20240101)")
    p.add_argument(
        "--output-dir", default=None,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    p.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    return p.parse_args()


def confirm(args, targets, out_dir):
    total = sum(int(v * args.scale) for v in targets.values())
    print(f"\n=== Crestview Freight Data Generator ===")
    tables_label = "all (18)" if args.tables == ALL_TABLES else str(len(args.tables))
    print(f"Tables:     {tables_label} tables")
    print(f"Scale:      {args.scale}x  →  ~{total:,} total rows")
    print(f"Date range: {args.start_date} to {args.end_date}")
    print(f"Output:     {out_dir}")
    print(f"Seed:       {args.seed}\n")
    if not args.yes:
        try:
            ans = input("Proceed? [y/N]: ").strip().lower()
        except EOFError:
            ans = "n"
        if ans != "y":
            print("Aborted.")
            sys.exit(0)


def target(name: str, scale: float) -> int:
    return max(1, int(BASE_TARGETS[name] * scale))


def main():
    global output_dir, fake, rng

    args = parse_args()

    start_date = datetime.strptime(args.start_date, "%Y-%m-%d").date()
    end_date = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    output_dir = args.output_dir or DEFAULT_OUTPUT_DIR

    os.makedirs(output_dir, exist_ok=True)

    targets = {t: target(t, args.scale) for t in BASE_TARGETS}

    confirm(args, targets, output_dir)

    # Seed everything
    random.seed(args.seed)
    np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)
    fake = Faker()
    Faker.seed(args.seed)

    _build_date_pool(start_date, end_date)

    print("\n--- Dimension tables ---")
    vendor_ids, vendor_weights = generate_dim_vendor(targets["dim_vendor"])
    gl_by_type = generate_dim_chart_of_accounts(targets["dim_chart_of_accounts"])
    dept_ids = generate_dim_department(targets["dim_department"])
    loc_ids = generate_dim_location(targets["dim_location"])
    emp_ids, emp_dept, emp_loc = generate_dim_employee(targets["dim_employee"], dept_ids, loc_ids)

    # Flatten GL IDs
    gl_all = [gid for ids in gl_by_type.values() for gid in ids]
    gl_expense = gl_by_type.get("Expense", gl_all)
    gl_asset = gl_by_type.get("Asset", gl_all)
    gl_liability = gl_by_type.get("Liability", gl_all)

    print("\n--- Fact tables ---")
    bill_records = generate_fact_bill(
        targets["fact_bill"], vendor_ids, vendor_weights, dept_ids, loc_ids
    )
    generate_fact_bill_line_item(
        targets["fact_bill_line_item"], bill_records, gl_expense, dept_ids, loc_ids
    )
    payment_records = generate_fact_bill_payment(bill_records)
    generate_fact_bill_payment_allocation(payment_records, bill_records)
    generate_fact_vendor_credit(targets["fact_vendor_credit"], vendor_ids, gl_liability, dept_ids)

    report_records = generate_fact_expense_report(targets["fact_expense_report"], emp_ids)
    report_ids = [r["id"] for r in report_records]
    generate_fact_expense_transaction(
        targets["fact_expense_transaction"], report_records, emp_ids, gl_expense, dept_ids, loc_ids
    )
    generate_fact_card_transaction(
        targets["fact_card_transaction"], emp_ids, gl_expense, dept_ids, report_ids
    )
    generate_fact_freight_invoice(targets["fact_freight_invoice"], vendor_ids, loc_ids, gl_expense)

    po_records = generate_fact_purchase_order(
        targets["fact_purchase_order"], vendor_ids, dept_ids, loc_ids, gl_asset, emp_ids
    )
    generate_fact_po_receipt(targets["fact_po_receipt"], po_records, loc_ids, emp_ids)

    print("\n--- Bridge tables ---")
    generate_bridge_po_bill_match(targets["bridge_po_bill_match"], po_records, bill_records)
    generate_bridge_bill_approval_log(bill_records, emp_ids)

    write_manifest(start_date, end_date)

    total_rows = sum(table_stats.values())
    print(f"\nDone. {total_rows:,} total rows written to {output_dir}/")


if __name__ == "__main__":
    main()
