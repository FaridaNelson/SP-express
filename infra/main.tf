terraform {
  required_version = ">= 1.15.0"
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}