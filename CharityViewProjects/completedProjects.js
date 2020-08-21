import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { Pagination } from 'react-bootstrap';
import StarRatings from 'react-star-ratings';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';
import './style.css';

class CharityCompletedProjects extends Component {
  constructor() {
    super();
    this.state = {
      myProjects: [],
      // myOrganisation: [],
      // reviewWindwoOpen: false,
      // feedbackData: {},
      currentOffset: 1,
    };
  }

  // react lifecycle method to display project right after componentMount on page
  componentDidMount() {
    this.getCompletedProjects();
  }

  getCompletedProjects = () => {
    Meteor.call('getCharityCompletedProjects', (error, response) => {
      if (!error) {
        this.setState({ myProjects: response });
      }
    });

    Meteor.call('getCharityCompletedProjectsLength', (error, response) => {
      if (!error) {
        this.setState({ myCompletedProjectsLength: response });
      }
    });
  };

  handlePageNumber(number) {
    this.setState(
      {
        currentOffset: number,
      },
      () => {
        const countValue = this.state.currentOffset;
        Meteor.call('getCharityCompletedProjects', countValue, (err, response) => {
          this.setState({ myProjects: response });
        });
      },
    );
  }

  handlePrevPage() {
    if (this.state.currentOffset > 1) {
      this.setState(
        {
          currentOffset: this.state.currentOffset - 1,
        },
        () => {
          const countValue = this.state.currentOffset;
          Meteor.call('getCharityCompletedProjects', countValue, (err, response) => {
            this.setState({ myProjects: response });
          });
        },
      );
    }
  }

  handleNextPage() {
    const numArray = this.renderNumbers();
    const finalPageCount = numArray.length;
    if (finalPageCount > this.state.currentOffset) {
      this.setState(
        {
          currentOffset: this.state.currentOffset + 1,
        },
        () => {
          const countValue = this.state.currentOffset;
          Meteor.call('getCharityCompletedProjects', countValue, (err, response) => {
            this.setState({ myProjects: response });
          });
        },
      );
    }
  }

  renderNumbers = () => {
    const items = [];
    const totalPages = Math.ceil(this.state.myCompletedProjectsLength / 4);

    // eslint-disable-next-line no-plusplus
    for (let number = 1; number <= totalPages; number++) {
      items.push(
        <Pagination.Item
          key={number}
          onClick={() => this.handlePageNumber(number)}
          className={this.state.currentOffset === number ? 'activeclass' : 'pageItem'}
        >
          {' '}
          {number}
        </Pagination.Item>,
      );
    }
    return items;
  };

  render() {
    const { myOrganisation, feedbackSubmission, thisUserId } = this.props;
    let completedProject = 0;

    return (
      <Fragment>
        {this.state.myProjects.map((data) => {
          let reviewed = false;
          let revieGet = false;
          if (data.workHistory !== undefined && data.workHistory.workStatus === 3) {
            let avatarImage = '';
            // eslint-disable-next-line no-lone-blocks
            {
              myOrganisation.map((data1) => {
                if (data1.coverImage) {
                  avatarImage = data1.coverImage;
                }
                return true;
              });
            }

            completedProject += 1;

            const date1 = new Date(data.projectData.deadline);

            const dateString = `${date1.toLocaleDateString('en-US', {
              day: 'numeric',
            })} ${date1.toLocaleDateString('en-US', {
              month: 'short',
            })} ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;
            const user = Meteor.user();
            const userrole = user.roles[0];

            return (
              <Tabstyle.col50 className="col50 completedProjects" key={completedProject}>
                <StyledTab.projectBox className="projectBox">
                  <StyledTab.projectBanner>
                    <StyledTab.BannerOverlay className="BannerOverlay">
                      {avatarImage !== undefined ? (
                        <BackgroundReturn imagePath={avatarImage} />
                      ) : (
                          ''
                        )}
                    </StyledTab.BannerOverlay>

                    <StyledTab.BannerCaption>
                      <StyledTab.bannerLogo className="bannerLogo">
                        {// eslint-disable-next-line no-nested-ternary
                          myOrganisation !== undefined && myOrganisation[0] !== undefined ? (
                            myOrganisation[0].avatar !== undefined ? (
                              <AwatarReturn avatarImage={myOrganisation[0].avatar} />
                            ) : (
                                ''
                              )
                          ) : (
                              'NA'
                            )}
                      </StyledTab.bannerLogo>

                      <StyledTab.projectlabelbox className="projectlabelbox">
                        {data.cause !== undefined && data.cause ? (
                          <StyledTab.projectlabel className="colorBagni">
                            {data.cause.name}
                          </StyledTab.projectlabel>
                        ) : (
                            ''
                          )}

                        {data.skill !== undefined && data.skill ? (
                          <StyledTab.projectlabel2 style={{ background: data.skill.color }}>
                            {data.skill.name}
                          </StyledTab.projectlabel2>
                        ) : (
                            ''
                          )}
                      </StyledTab.projectlabelbox>
                    </StyledTab.BannerCaption>
                  </StyledTab.projectBanner>

                  <StyledTab.projectDetail className="projectDetail">
                    <StyledTab.projectHeading>{data.projectData.title}</StyledTab.projectHeading>
                    <StyledTab.projectHeadinglabel>
                      {data.projectData.subTitle}
                    </StyledTab.projectHeadinglabel>

                    <StyledTab.projecHrlabel>
                      {data.projectData.hours} hours over {data.projectData.days} days | Deadline{' '}
                      {dateString}
                    </StyledTab.projecHrlabel>
                    {console.log(data.feedbackData)}
                  </StyledTab.projectDetail>

                  {data.feedbackData !== undefined && data.feedbackData.length > 0 ? (
                    data.feedbackData.map((feedbk) => {
                      if (feedbk.userId === thisUserId) {
                        reviewed = true;
                      }
                      if (feedbk.userId !== thisUserId && userrole !== feedbk.givenBy) {
                        revieGet = true;
                        return (
                          <div>
                            <div style={{ textAlign: 'center', paddingTop: '15px' }}>
                              <StarRatings
                                rating={feedbk.rating}
                                starDimension="40px"
                                starSpacing="15px"
                                starRatedColor="#F3DE6F"
                              />
                            </div>
                            <p className="givenFeedback">{feedbk.feedback}</p>
                            {/*
                            <Tabstyle.styledbtn>
                              <a
                                target="_blank"
                                rel="noopener noreferrer"
                                href={`https://www.linkedin.com/shareArticle/?mini=true&url=${Meteor.absoluteUrl(
                                  `project/${data.projectData._id}/` +
                                    `charity` +
                                    `/${Meteor.userId()}`,
                                )}`}
                                className="btnFull"
                              >
                                SHARE ON LINKEDIN
                              </a>
                            </Tabstyle.styledbtn>
                            */}
                          </div>
                        );
                      }
                      return true;
                    })
                  ) : (
                      <div>
                        <h3 className="completeLabel">COMPLETE</h3>
                        <p className="completeTextInfo">
                          CONGRATULATIONS!
                        <br />
                          THE PROJECT FINISHED!
                      </p>
                        <p className="completedGreyText">
                          Leave feedback for the volunteer to unlock your review and download the
                          finished project.
                      </p>
                      </div>
                    )}

                  <div>
                    {revieGet === false && reviewed === true ? (
                      <Fragment>
                        <h3 className="completeLabel">COMPLETE</h3>
                        <p className="completeTextInfo">
                          CONGRATULATIONS!
                          <br />
                          THE PROJECT FINISHED!
                        </p>
                        <p className="completedGreyText">Waiting for volunteer to provide review</p>
                      </Fragment>
                    ) : (
                        ''
                      )}
                  </div>

                  {reviewed === true ? (
                    <Tabstyle.styledbtn>
                      <button
                        type="submit"
                        className="btnFull"
                        onClick={() => feedbackSubmission(data)}
                      >
                        Your Feedback
                      </button>
                    </Tabstyle.styledbtn>
                  ) : (
                      <Tabstyle.styledbtn>
                        <button
                          type="submit"
                          className="btnFull"
                          onClick={() => feedbackSubmission(data)}
                        >
                          LEAVE FEEDBACK
                      </button>
                      </Tabstyle.styledbtn>
                    )}
                </StyledTab.projectBox>
              </Tabstyle.col50>
            );
          }
          return true;
        })}
        {
          completedProject === 0 ? (<h3 className="noProjectFound" style={{ textAlign: 'center' }}> No Project Found </h3>) : ("")
        }
        {(Math.ceil(this.state.myCompletedProjectsLength / 4) > 1) ?
          <Pagination>
            <Pagination.Prev
              onClick={() => this.handlePrevPage()}
              className={this.state.currentOffset === 1 ? 'disableLink pageNext' : 'pageNext'}
            />
            {this.renderNumbers()}
            <Pagination.Next
              onClick={() => this.handleNextPage()}
              className={
                this.state.currentOffset === Math.ceil(this.state.myActiveProjectsLength / 4)
                  ? 'disableLink pageNext'
                  : 'pageNext'
              }
            />
          </Pagination>
          : ""}
      </Fragment>
    );
  }
}
CharityCompletedProjects.propTypes = {
  myOrganisation: PropTypes.array.isRequired,
  thisUserId: PropTypes.string.isRequired,
  feedbackSubmission: PropTypes.func.isRequired,
};
export default CharityCompletedProjects;
