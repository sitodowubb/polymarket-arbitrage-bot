"""``svb`` CLI."""
import argparse

from .runner import run_eval, score_predictions


def _cmd_run(args):
    out = args.output or f"predictions/{args.model}.jsonl"
    run_eval(args.model, args.items, out, task=args.task, limit=args.limit)


def _cmd_score(args):
    score_predictions(args.items, args.predictions, report=True)


def main():
    p = argparse.ArgumentParser("svb")
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("run")
    pr.add_argument("--model", required=True)
    pr.add_argument("--items", default="data/svb_v1.jsonl")
    pr.add_argument("--output", default=None)
    pr.add_argument("--task", default=None)
    pr.add_argument("--limit", type=int, default=None)
    pr.set_defaults(fn=_cmd_run)
    ps = sub.add_parser("score")
    ps.add_argument("predictions")
    ps.add_argument("--items", default="data/svb_v1.jsonl")
    ps.set_defaults(fn=_cmd_score)
    args = p.parse_args(); args.fn(args)


if __name__ == "__main__":
    main()
