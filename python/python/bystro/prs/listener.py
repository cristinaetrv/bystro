"""
    CLI tool to start PRS job listener
"""
import argparse
import logging

from ruamel.yaml import YAML

from bystro.beanstalkd.worker import (
    QueueConf,
    listen,
)
from bystro.beanstalkd.messages import SubmittedJobMessage
from bystro.prs.messages import PRSJobData, PRSJobResult, PRSJobResultMessage
from bystro.prs.handler import make_calculate_prs_scores

logging.basicConfig(
    filename="prs_listener.log",
    level=logging.DEBUG,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(module)s - %(funcName)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger()

TUBE = "prs"


def submit_msg_fn(job_data: PRSJobData):
    return SubmittedJobMessage(submission_id=job_data.submission_id)


def completed_msg_fn(job_data: PRSJobData, results: PRSJobResult) -> PRSJobResultMessage:
    return PRSJobResultMessage(submission_id=job_data.submission_id, results=results)


def main():
    """
    Start PRS listener that handles PRS jobs
    """
    parser = argparse.ArgumentParser(description=f"Start a listener for {TUBE} Bystro jobs")

    parser.add_argument(
        "--queue_conf",
        type=str,
        help="Path to the beanstalkd queue config yaml file (e.g beanstalk1.yml)",
        required=True,
    )

    parser.add_argument(
        "--search_conf",
        type=str,
        help="Path to the opensearch config yaml file (e.g. elasticsearch.yml)",
        required=True,
    )
    args = parser.parse_args()

    
    args = parser.parse_args()

    with open(args.queue_conf, "r", encoding="utf-8") as queue_config_file:
        queue_conf = YAML(typ="safe").load(queue_config_file)

    with open(args.search_conf, "r", encoding="utf-8") as search_config_file:
        search_conf = YAML(typ="safe").load(search_config_file)

    calculate_prs_scores = make_calculate_prs_scores(search_conf)

    listen(
        job_data_type=PRSJobData,
        handler_fn=calculate_prs_scores,
        submit_msg_fn=submit_msg_fn,
        completed_msg_fn=completed_msg_fn,
        queue_conf=QueueConf(**queue_conf["beanstalkd"]),
        tube=TUBE,
    )


if __name__ == "__main__":
    main()
