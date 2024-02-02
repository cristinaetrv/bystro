"""Provide a worker for the ancestry model."""
import argparse
import logging
from collections.abc import Callable
from pathlib import Path

import boto3  # type: ignore
import pandas as pd
from ruamel.yaml import YAML
from skops.io import load as skops_load  # type: ignore

from bystro.ancestry.ancestry_types import AncestryResults
from bystro.ancestry.inference import AncestryModel, infer_ancestry
from bystro.beanstalkd.messages import BaseMessage, CompletedJobMessage, SubmittedJobMessage
from bystro.beanstalkd.worker import ProgressPublisher, QueueConf, get_progress_reporter, listen

import pyarrow.dataset as ds  # type: ignore

logging.basicConfig(
    filename="ancestry_listener.log",
    level=logging.DEBUG,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(module)s - %(funcName)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger()

ANCESTRY_TUBE = "ancestry"
ANCESTRY_BUCKET = "bystro-ancestry"
PCA_FILE = "pca.csv"
RFC_FILE = "rfc.skop"


def _get_model_from_s3() -> AncestryModel:
    s3_client = boto3.client("s3")

    s3_client.download_file(Bucket=ANCESTRY_BUCKET, Key=PCA_FILE, Filename=PCA_FILE)
    s3_client.download_file(Bucket=ANCESTRY_BUCKET, Key=RFC_FILE, Filename=RFC_FILE)

    logger.info("Loading PCA file %s", PCA_FILE)
    pca_loadings_df = pd.read_csv(PCA_FILE, index_col=0)
    logger.info("Loading RFC file %s", RFC_FILE)
    rfc = skops_load(RFC_FILE)
    logger.info("Loaded ancestry models from S3")
    return AncestryModel(pca_loadings_df, rfc)


class AncestryJobData(BaseMessage, frozen=True):
    """The input data expected from the job json message."""

    dosage_matrix_path: str


class AncestryJobCompleteMessage(CompletedJobMessage, frozen=True, kw_only=True):
    """The returned JSON message expected by the API server"""

    results: AncestryResults


def _load_queue_conf(queue_conf_path: str) -> QueueConf:
    with Path(queue_conf_path).open(encoding="utf-8") as queue_config_file:
        raw_queue_conf = YAML(typ="safe").load(queue_config_file)
    beanstalk_conf = raw_queue_conf["beanstalkd"]
    return QueueConf(addresses=beanstalk_conf["addresses"], tubes=beanstalk_conf["tubes"])


def handler_fn_factory(
    ancestry_model: AncestryModel,
) -> Callable[[ProgressPublisher, AncestryJobData], AncestryResults]:
    """Return partialed handler_fn with ancestry_model loaded."""

    def handler_fn(publisher: ProgressPublisher, job_data: AncestryJobData) -> AncestryResults:
        """Do ancestry job, wrapping infer_ancestry for beanstalk."""
        # Separating _handler_fn from infer_ancestry in order to separate ML from infra concerns,
        # and especially to keep infer_ancestry eager.

        # not doing anything with this reporter at the moment, we're
        # simply threading it through for later.
        _reporter = get_progress_reporter(publisher)

        dataset = ds.dataset([job_data.dosage_matrix_path], format="arrow")

        return infer_ancestry(ancestry_model, dataset)

    return handler_fn


def submit_msg_fn(ancestry_job_data: AncestryJobData) -> SubmittedJobMessage:
    """Acknowledge receipt of AncestryJobData."""
    logger.debug("entering submit_msg_fn: %s", ancestry_job_data)
    return SubmittedJobMessage(ancestry_job_data.submissionID)


def completed_msg_fn(
    ancestry_job_data: AncestryJobData, results: AncestryResults
) -> AncestryJobCompleteMessage:
    """Send job complete message."""
    logger.debug("entering completed_msg_fn: %s", ancestry_job_data)

    return AncestryJobCompleteMessage(submissionID=ancestry_job_data.submissionID, results=results)


def main(ancestry_model: AncestryModel, queue_conf: QueueConf) -> None:
    """Run ancestry listener."""
    handler_fn_with_models = handler_fn_factory(ancestry_model)
    logger.info(
        "Ancestry worker is listening on addresses: %s, tube: %s...", queue_conf.addresses, ANCESTRY_TUBE
    )
    listen(
        AncestryJobData,
        handler_fn_with_models,
        submit_msg_fn,
        completed_msg_fn,
        queue_conf,
        ANCESTRY_TUBE,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process some config files.")
    parser.add_argument(
        "--queue_conf",
        type=Path,
        help="Path to the beanstalkd queue config yaml file (e.g beanstalk1.yml)",
        required=True,
    )
    args = parser.parse_args()

    ancestry_model = _get_model_from_s3()
    queue_conf = _load_queue_conf(args.queue_conf)

    main(ancestry_model, queue_conf)
